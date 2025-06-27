// core modules
// import dotenv from "dotenv";
require("dotenv").config(); 
const mammoth = require('mammoth');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const express = require('express')
const axios = require("axios");
// const { OpenAI } = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {mongoConnect} = require('./utils/mongodb')
const {getDb} = require('./utils/mongodb')
console.log("Gemini Key Loaded:", process.env.GEMINI_API_KEY ? "✅" : "❌");


const cors  = require('cors')
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const rootDir = require('./utils/path')


// const resumeRoute = require('./routes/resumeHandler')

const app = express();
app.use(cors());
// app.use(cors({
//   origin: process.env.FRONTEND_URL,  // only allow your frontend
//   credentials: true
// }));
app.use(bodyParser.json()); 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });






// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });



// (async () => {
//   try {
//     const models = await genAI.listModels({ apiVersion: "v1" });
//     console.log("✅ Available Gemini Models:");
//     models.forEach(m => console.log(m.name));
//   } catch (err) {
//     console.error("❌ Failed to list models:", err.message);
//   }
// })();

app.post("/enhance", async (req, res) => {
  const { type, content } = req.body;

  if (!type || !content) {
    return res.status(400).json({ error: "Missing type or content." });
  }

  try {
    const prompt = `
You are an AI resume assistant. Please improve the following "${type}" section. Make it more impactful, professional, and impressive. Keep the tone suitable for job applications.

Content:
"""
${content}
"""

Respond with only the enhanced version.
`;

    const result = await model.generateContent([prompt]);
    const enhancedText = result.response.text();

    console.log("✅ Enhanced:", enhancedText);
    res.status(200).json({ enhanced: enhancedText });

  } catch (err) {
    console.error("❌ AI Enhancement Error (full):", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

    res.status(500).json({ error: "AI enhancement failed." });
  }
});




app.post("/save",async(req, res) => {
  const resumeData = req.body;
  const db = getDb();
   try {
    const result = await db.collection("resume").updateOne(
      {},                          // find any (you can customize filter)
      { $set: resumeData },        // overwrite with latest
      { upsert: true }             // create new if none exists
    );

    console.log("✅ Resume saved successfully!", result);
    res.status(200).json({ message: "Resume saved successfully!" });  // ✅ Required!
  } catch (err) {
    console.error("❌ Error saving resume:", err.message);
    res.status(500).json({ message: "Failed to save resume." });
  }
});

 



app.get("/load", async (req, res) => {
  try {
    const db = getDb();
    const latestResume = await db.collection("resume").findOne({}, { sort: { _id: -1 } }); // get latest

    if (!latestResume) {
      return res.status(404).json({ message: "No saved resume found." });
    }

    res.status(200).json(latestResume);
  } catch (error) {
    console.error("Error loading resume from MongoDB:", error.message);
    res.status(500).json({ message: "Failed to load resume." });
  }
});




const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join("uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only PDF and DOCX"));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

const extractTextFromPDF = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text.trim();
};

const extractTextFromDOCX = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.trim();
};

const parseResumeWithAI = async (text) => {
  try {
    const prompt = `Extract the following resume into structured JSON:
{text: "${text}"}`;
    const result = await model.generateContent([prompt]);
    const responseText = result.response.text().trim();
    return JSON.parse(responseText.replace(/json|```/g, '').trim());
  } catch (error) {
    console.error("Gemini parsing failed:", error.message);
    throw new Error("Gemini parsing failed.");
  }
};

app.post("/upload-resume", upload.single("resumeFile"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const extractedText = ext === ".pdf"
      ? await extractTextFromPDF(filePath)
      : await extractTextFromDOCX(filePath);
    const parsedData = await parseResumeWithAI(extractedText);
    fs.unlinkSync(filePath);
    res.status(200).json({ success: true, data: parsedData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});






const PORT = process.env.PORT || 4000;
mongoConnect(()=>{
  console.log("Connected to MongoDB");
  app.listen(PORT,()=>{
  console.log(`server on http://localhost:${PORT}`)
})
})
