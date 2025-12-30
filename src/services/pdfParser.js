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
            // Sab text ko aik line mein join krain takay spacing ka masla na ho
            fullText += content.items.map(s => s.str).join(" ") + " ";
        }

        // 1. Semesters ko "Term:" se split krain
        const termSections = fullText.split(/Term:\s+/i);
        let semesters = [];

        termSections.slice(1).forEach(section => {
            // Term name nikalna (e.g., FALL 2023)
            const semMatch = section.match(/^([A-Z]+\s+\d{4})/i);
            const semesterObj = {
                id: Date.now() + Math.random(),
                name: semMatch ? semMatch[1] : "Imported Semester",
                subjects: []
            };

            // 2. ✅ UPDATED REGEX: Jo aapke console text format ko match kray ga
            // Groups: 1:Sr#, 2:Code, 3:Title, 4:CH, 5:Total, 6:Obtained, 7:Grade
            const rowRegex = /(\d+)\s+([A-Z0-9]{5,})\s+([\s\S]+?)\s*(\d\.\d{2})\s+(\d+)\s+(\d+(?:\.\d{2})?)\s+([A-F][+-]?)/g;
            
            let m;
            while ((m = rowRegex.exec(section)) !== null) {
                const title = m[3].trim();
                const ch = parseFloat(m[4]);
                const obt = parseFloat(m[6]);

                if (!isNaN(ch) && !isNaN(obt)) {
                    semesterObj.subjects.push({
                        id: Date.now() + Math.random(),
                        title: title,
                        ch: ch,
                        simpleObt: obt,
                        mode: 'simple',
                        assessments: []
                    });
                }
            }
            if (semesterObj.subjects.length > 0) semesters.push(semesterObj);
        });

        return semesters;
    } catch (error) {
        console.error("PDF Parsing Error:", error);
        throw error;
    }
};

export const calculateGrade = (m) => {
    if (m >= 85) return { g: "A", p: 4.0 };
    if (m >= 80) return { g: "A-", p: 3.66 };
    if (m >= 75) return { g: "B+", p: 3.33 };
    if (m >= 71) return { g: "B", p: 3.0 };
    if (m >= 68) return { g: "B-", p: 2.66 };
    if (m >= 64) return { g: "C+", p: 2.33 };
    if (m >= 61) return { g: "C", p: 2.0 };
    if (m >= 58) return { g: "C-", p: 1.66 };
    if (m >= 54) return { g: "D+", p: 1.30 };
    if (m >= 50) return { g: "D", p: 1.0 };
    return { g: "F", p: 0.0 };
};