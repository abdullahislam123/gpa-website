import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const parseSuperiorTranscript = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            // Text fragments ko join karte waqt extra spaces ko handle kiya
            const pageText = content.items.map(s => s.str).join(" ");
            fullText += pageText + "\n"; 
        }

        console.log("Extracted Text Sample:", fullText.substring(0, 500)); // Debugging ke liye

        // 1. Semesters ko split krain
        const termSections = fullText.split(/Term:/i);
        let semesters = [];

        termSections.slice(1).forEach((section, index) => {
            // Term name extraction (e.g., FALL 2023)
            const lines = section.trim().split('\n');
            const termNameMatch = lines[0].match(/([A-Z]+\s+\d{4})/i);
            
            const semesterObj = {
                id: Date.now() + Math.random() + index,
                name: termNameMatch ? termNameMatch[1].toUpperCase() : "Imported Semester",
                subjects: []
            };

            // 2. ✅ IMPROVED REGEX: Yeh flexible hai spacing aur decimals ke liye
            // Sr# | Code | Title | CH | Total | Obt | Grade
            const rowRegex = /(\d+)\s+([A-Z0-9-]{4,})\s+(.+?)\s+(\d(?:\.\d+)?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+([A-F][+-]?|W|I)/g;
            
            let m;
            while ((m = rowRegex.exec(section)) !== null) {
                const title = m[3].trim();
                const ch = parseFloat(m[4]);
                const obt = parseFloat(m[6]);

                if (!isNaN(ch) && !isNaN(obt)) {
                    semesterObj.subjects.push({
                        id: Math.random().toString(36).substr(2, 9),
                        title: title,
                        ch: ch,
                        simpleObt: obt,
                        mode: 'simple',
                        assessments: []
                    });
                }
            }

            if (semesterObj.subjects.length > 0) {
                semesters.push(semesterObj);
            }
        });

        if (semesters.length === 0) {
            console.warn("No semesters were parsed. Check if the PDF format matches.");
        }

        return semesters;
    } catch (error) {
        console.error("PDF Parsing Error:", error);
        throw error;
    }
};

export const calculateGrade = (m) => {
    const marks = Math.round(m); 
    if (marks >= 85) return { g: "A", p: 4.00 };
    if (marks >= 80) return { g: "A-", p: 3.66 };
    if (marks >= 75) return { g: "B+", p: 3.33 };
    if (marks >= 71) return { g: "B", p: 3.00 };
    if (marks >= 68) return { g: "B-", p: 2.66 };
    if (marks >= 64) return { g: "C+", p: 2.33 };
    if (marks >= 61) return { g: "C", p: 2.00 };
    if (marks >= 58) return { g: "C-", p: 1.66 };
    if (marks >= 54) return { g: "D+", p: 1.30 };
    if (marks >= 50) return { g: "D", p: 1.00 };
    return { g: "F", p: 0.00 };
};