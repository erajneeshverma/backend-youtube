import express from 'express'
import cors from 'cors';
import cookiesParser from 'cookies-parser';

const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));

//data coming from api, databses,etc.. in whats from setup 
app.use(express.json({
    limit:"16kb"
}))

//data coming from url string
app.use(express.urlencoded({
    extended:true,
    limit: "16kb"
}));

//to store files(public assests) in my server
app.use(express.static("public"))


app.use(cookiesParser());


export {app}