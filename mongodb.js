const mongodb = require('mongodb');
require("dotenv").config(); 
const MongoClient = mongodb.MongoClient;

const url = 'mongodb+srv://ResumeProject:vanshika@resumeproject.mg97mdz.mongodb.net/?retryWrites=true&w=majority&appName=ResumeProject'

let _db;



const mongoConnect = async (callback) => {
    try {
        const client = await MongoClient.connect(process.env.MONGODB_URI);
        _db = client.db(); 
       callback();
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

const getDb = () => {
    if(!_db){
        throw new Error('No database found! mongo not connected');
    }
    return _db;
}

exports.mongoConnect = mongoConnect
exports.getDb = getDb