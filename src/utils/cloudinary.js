import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs'

          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath){
            console.log("File path Error!!");
            return "File Path Error";
        }
        const res = await cloudinary.uploader.upload(localFilePath,{
            resource_type: 'auto'
        })
        //file has beed uploaded successfully
        //console.log("File Uploaed on cluoudinary Successfully",res.url);
        fs.unlinkSync(localFilePath);
        return res;
    } catch (error) {
        fs.unlinkSync(localFilePath); //rmove the locally saved temporary file as the upload operation failed
        console.log("uploadOnCloudinary Error : ",error);
        return null;
    }
}

export {uploadOnCloudinary};