import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBQfE_ubdiP5DJSkvwLNHzptlNI85MK8ys",
    authDomain: "super-gpa-calc.firebaseapp.com",
    projectId: "super-gpa-calc",
    storageBucket: "super-gpa-calc.firebasestorage.app",
    messagingSenderId: "559503103274",
    appId: "1:559503103274:web:c0be6e61f637333ed93a53"
};

const app = firebase.initializeApp(firebaseConfig);
export const auth = app.auth();
export const db = app.firestore();
export const googleProvider = new firebase.auth.GoogleAuthProvider();