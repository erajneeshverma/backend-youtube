import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});
        
        return {accessToken,refreshToken};

    } catch (error) {
        return new ApiResponse(400,"Something Wrong happend while generating access token and refresh token");
    }
}

const registerUser = asyncHandler( async (req,res) => {
    //step-1 :  get user details from frontend
    //step-2 : validatiuons (server side validation)
    //step-3 : check if already exist
    //step-4 : check for images and  check for avatar(compulsory)
    //step-5 : upload to cloudenary / avatar
    //step-6 : create a user object - create db calls (create a user)
    //step-7 : remove password and refresh token field from response
    //step-8 : check for user creation - > null or created
    //step-9 : return response // error

    //step-1 :  get user details from frontend

    const {username, fullName, email, password } = req.body;
   // console.log(email,password,username,fullName);
    
    //step-2 : validatiuons (server side validation)
    if([fullName,email,password,username].some((field)=> field?.trim()==="")){
        throw new ApiError(400,"All fields are required");
    }

    //step-3 : check if already exist

    const existedUser = await User.findOne({
        $or: [{ email }, { username }]
    });
    if(existedUser){
        throw new ApiError(409,"username or email already exists")
    }

    //step-4 : check for images and  check for avatar(compulsory)
    // console.log(req.files.avatar);
    // console.log(req.files.coverImage);
    
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required..");
    }

    //step-5 : upload to cloudenary / avatar
    
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar file is required..");
    }

    //step-6 : create a user object - create db calls (create a user)

    const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email,
        password,
        avatar:avatar.url,
        coverImage:coverImage?.url || "" ,
    });

    //step-7 : remove password and refresh token field from response

    const createdUser = await User.findById(user._id).select(
        "-password -refershToken"
    );

    //step-8 : check for user creation - > null or created

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user");
    }

    //step-9 : return response // error

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User Registered Successfully")
    )
})

const loginUser = asyncHandler(async (req,res) => {
    //1. get the details from user (username/email, password)
    //2. check for validation
    //3. check user exists or not
    //if exists then
    //5. password check
    //6.get the details of the user (except password ,....)
    //7. generate access token and refresh token
    //8. return cookies +  response to the user/frontend with user details

    //1. get the details from user (username/email, password)
    const {username,email,password} = req.body;

    //2. check for validation
    if(!(username || email)){
        return new ApiError(400,"Username or email is required...");
    }

    //3. check user exists or not
    const user = await User.findOne({
        $or: [{email},{username}]
    })

    if(!user){
        return new ApiError(400,"User not registered...");
    }

    //5. password check

    const isMatchPass = await user.isPasswordCorrect(password);

    if(!isMatchPass){
        return new ApiError(400,"User Password is incorrect");
    }

    //6.get the details of the user (except password ,....)

    //user details are avialble in use

    //7. generate access token and refresh token

    
    const {refreshToken,accessToken} = await generateAccessAndRefreshToken(user._id);

    //8. return cookies +  response to the user/frontend with user details

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly : true,
        secure: true,
    }

    return res
            .status(200)
            .cookie("accessToken", accessToken,options)
            .cookie("refreshToken",refreshToken,options)
            .json(
                new ApiResponse(
                    200,
                    {
                        user:loggedInUser,
                        accessToken,
                        refreshToken,
                    },
                    "User Logged In Successfully"
                    )
            );
});

const logoutUser = asyncHandler( async(req,res)=>{
    
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }  
        },
        {
            new: true
        }
        );
    
    const options= {
        httpOnly: true,
        secure: true,
    }

    return res
            .status(200)
            .clearCookie("accessToken", undefined)
            .clearCookie("refreshToken", undefined)
            .json(
                new ApiResponse(200,{},"User Logged Out Successfully")
            );
})

const refreshAccessToken = asyncHandler( async (req,res) => {
    
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if(!incomingRefreshToken){
        throw new ApiError(400,"Unauthorized Request");
    }

    try {
        const decodedRefreshToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedRefreshToken?._id);
    
        if(!user){
            throw new ApiError(400,"Invalid Refresh Token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(400,"Refresh Token is Expired or used");
        }
    
        const options = {
            httpOnly: true,
            secure :true,
        }
    
        const {newrefreshToken,accessToken} = await generateAccessAndRefreshToken(user._id);
    
        return res
                .status(200)
                .cookie("accessToken",accessToken)
                .cookie("refreshToken",newrefreshToken)
                .json(
                    new ApiResponse(200,{accessToken,newrefreshToken},"Access Token Refreshed")
                )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Refresh Token");
    }

})

const changeCurrentPassword = asyncHandler( async (req,res) =>{

    const {oldPassword, newPassword} = req.body;

    if(!oldPassword || !newPassword){
        throw new ApiError(400,"Old Password and New Password required");
    }

    const user = await User.findById(req.user?._id);

    if(!user){
        throw new ApiError(400,"User not found Kindly login first..");
    }

    const isMatchPass = await user.isPasswordCorrect(oldPassword);

    if(!isMatchPass){
        throw new ApiError(400,"Old Password is incorrect");
    }

    user.password = newPassword;

    await user.save({validateBeforeSave:true});

    return res.status(200).json(
        new ApiResponse(200,{},"Password Changed Successfully")
    )
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200).json(
        new ApiResponse(200,req.user,"Current User Fetched Successfully")
    )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    
    const {fullName,email} = req.body;

    if(!fullName || !email){
        throw new ApiError(400,"FullName and Email is required");
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                fullName: fullName,
                email: email
            }
        },
        {new:true}
        ).select("-password");

    if(!user){
        throw new ApiError(400,"User not Login or, session expired");
    }

    return res.status(200).json(
        new ApiResponse(200,user,"Account Details Updated Successfully")
    )
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    
    const avatarLocalPath = req.file?.path;
    
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar File required..");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400,"Avatar Upload on cloudnary failed");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new:true}
    );

    return res.status(200).json(
        new ApiResponse(200,user,"User Avatar Updated")
    )
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    
    const coverImageLocalPath = req.file?.path;
    
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image File required..");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400,"Cover Image Upload on cloudnary failed");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new:true}
    ).select("-password");

    return res.status(200).json(
        new ApiResponse(200,user,"User Cover Image Updated")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};