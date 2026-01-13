import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, getDocs, writeBatch } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAxkaOuyaDxGEScaCgO2KY-vqXVwjTXlPQ",
  authDomain: "netflixdeli.firebaseapp.com",
  databaseURL: "https://netflixdeli-default-rtdb.firebaseio.com",
  projectId: "netflixdeli",
  storageBucket: "netflixdeli.firebasestorage.app",
  messagingSenderId: "970199755396",
  appId: "1:970199755396:web:9821ace182b4d42cadb0d1",
  measurementId: "G-SNEF25N9CF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Analytics (only in browser)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Collection references
const messagesCollection = collection(db, 'messages');
const usersCollection = collection(db, 'users');

// Message functions
export const sendMessage = async (message: {
  username: string;
  avatar: string;
  text: string;
  timestamp: number;
}) => {
  return await addDoc(messagesCollection, message);
};

export const subscribeToMessages = (callback: (messages: any[]) => void) => {
  const q = query(messagesCollection, orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
};

export const clearAllMessages = async () => {
  const q = query(messagesCollection);
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  return await batch.commit();
};

// User functions
export const saveUser = async (userId: string, userData: { username: string; avatar: string }) => {
  const userRef = collection(db, 'users');
  // Firestore'da userId ile document oluştur veya güncelle
  return await addDoc(userRef, {
    userId: userId,
    ...userData,
    createdAt: Date.now()
  });
};

export { db };
