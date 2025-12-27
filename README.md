# 🎓 Super GPA Calc | Elite Academic Portal

**Super GPA Calc** is a precision-engineered academic management tool designed specifically for Superior University students. It bridges the gap between official ERP results and student academic planning by providing a modern, responsive, and high-accuracy GPA calculation engine.

---

## 🌟 Key Features

### ⚡ Smart Sync Technology
* **PDF Integration:** Instantly import official result cards and transcripts using the integrated `PDF.js` engine. No more manual data entry.
* **Excel Support:** Seamlessly upload `.xlsx` or `.csv` files to populate your academic history.

### 📊 Dual-Mode Calculation Engine
* **Simple Mode:** Quick calculation based on total obtained marks (0-100).
* **Assessment Mode:** A "What-if" planner where students can input weights for Quizzes, Mid-terms, and Finals to predict their final grade before the semester ends.

### 🛡️ Secure & Private
* **Official Authentication:** Restricted access to `@superior.edu.pk` email holders to maintain institutional integrity.
* **Local-First Privacy:** All data is encrypted and stored in the browser's `LocalStorage`. Your grades never leave your device.

### 💎 Elite User Experience
* **ERP-Synced Logic:** Calculations strictly follow the official university grading points.
* **Responsive Design:** Optimized for Desktop, Tablet, and Mobile devices using the *Plus Jakarta Sans* design system.

---

## 🛠️ Technical Stack
* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3.
* **Libraries:** [PDF.js](https://mozilla.github.io/pdf.js/), [SheetJS / XLSX](https://sheetjs.com/)
* **Fonts:** Google Fonts (Plus Jakarta Sans).
* **Storage:** Browser LocalStorage API.

---

## 🚀 Getting Started
Since this is a client-side application, it requires **no server installation**.
1. **Download** the `index.html` file.
2. **Open** the file in any modern web browser.
3. **Register** using your official `@superior.edu.pk` email.
4. **Start Tracking** your academic journey!

---

## 📏 Grading Logic (Official 2.55 System)
The system is hardcoded with the official university grading scale to ensure 100% accuracy:

| Marks | Grade | Point |
| :--- | :--- | :--- |
| 85 - 100 | A | 4.00 |
| 80 - 84 | A- | 3.66 |
| 75 - 79 | B+ | 3.33 |
| 71 - 74 | B | 3.00 |
| Below 50 | F | 0.00 |

---

## 📂 Project Structure
```text
├── index.html          # Main application (Logic, Styles, and UI)
├── README.md           # Documentation
└── (External Libs)     # Loaded via CDN (PDF.js, XLSX)