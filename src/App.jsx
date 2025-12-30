import React, { useState, useEffect } from 'react';
import { auth, db } from './services/firebase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Loading from './components/loading';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ 1. Hooks MUST come first
  useEffect(() => {
    console.log("Auth Listener initialized...");
    
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      try {
        setUser(u);
        if (u) {
          console.log("User detected, fetching data...");
          const doc = await db.collection("users").doc(u.uid).get();
          if (doc.exists) {
            setSemesters(doc.data().semesters || []);
          }
        } else {
          setSemesters([]);
        }
      } catch (error) {
        console.error("Firebase connection error:", error);
      } finally {
        // ✅ 2. Always stop loading regardless of success or failure
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 3. Persistence Logic
  const handleUpdate = async (newData) => {
    setSemesters(newData);
    if (user) {
      try {
        await db.collection("users").doc(user.uid).set(
          { semesters: newData }, 
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to save data:", err);
      }
    }
  };

  // ✅ 4. Conditional Rendering comes AFTER hooks
  if (loading) {
    return <Loading />; 
  }

  return (
    <div className="app-root selection:bg-blue-100">
      {!user ? (
        <Auth />
      ) : (
        <Dashboard 
          user={user} 
          semesters={semesters} 
          onUpdate={handleUpdate} 
        />
      )}
    </div>
  );
}

export default App;