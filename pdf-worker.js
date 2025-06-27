// pdf-worker.js
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'; // ✅ use .mjs here

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
