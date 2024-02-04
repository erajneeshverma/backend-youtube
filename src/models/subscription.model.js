import mongoose, { Schema } from "mongoose";

const subscriptionSchema = mongoose.Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    channel:{
        type: Schema.Types.ObjectId,
        ref: "User"
    }
},{timestamps:true});

const Subscription = new mongoose.model("Subscription",subscriptionSchema);