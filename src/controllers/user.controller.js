import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
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
    console.log(email,password,username,fullName);
    
    //step-2 : validatiuons (server side validation)
    if([fullName,email,password,username].some((field)=> field?.trime()==="")){
        throw new Error(400,"All fields are required");
    }

    //step-3 : check if already exist

    const existedUser = User.findOne({
        $or: [{ email }, { username }]
    });
    if(existedUser){
        throw new Error(409,"username or email already exists")
    }

    //step-4 : check for images and  check for avatar(compulsory)

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
    if(!avatarLocalPath){
        throw new Error(400,"Avatar file is required..");
    }

    //step-5 : upload to cloudenary / avatar
    
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new Error(400,"Avatar file is required..");
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
        throw new Error(500,"Something went wrong while registering the user");
    }

    //step-9 : return response // error

    return res.sataus(201).json(
        new ApiResponse(200,createdUser,"User Registered Successfully")
    )
})


export {registerUser};