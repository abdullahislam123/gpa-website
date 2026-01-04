import Tesseract from 'tesseract.js';

export const scanImageForMarks = async (imageFile) => {
    const { data: { text } } = await Tesseract.recognize(imageFile, 'eng');
    
    // Yahan hum Regex use karke text se numbers nikalenge
    // Maslan agar text hai "Quiz 1: 10/15", toh ye 10 aur 15 nikal lega
    const marksPattern = /(\d+)\s*[\/\s]\s*(\d+)/g; 
    let match;
    const results = [];

    while ((match = marksPattern.exec(text)) !== null) {
        results.push({
            obtained: match[1],
            total: match[2]
        });
    }
    return results;
};  