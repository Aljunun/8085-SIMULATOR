import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, getDocs, writeBatch } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
const storage = getStorage(app);

// Initialize Analytics (only in browser)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// Collection references
const channelsCollection = collection(db, 'channels');
const messagesCollection = (channelId: string) => collection(db, `channels/${channelId}/messages`);
const whiteboardStrokesCollection = (channelId: string) => collection(db, `channels/${channelId}/whiteboard`);
const usersCollection = collection(db, 'users');
const coursesCollection = collection(db, 'courses');
const courseFilesCollection = (courseId: string) => collection(db, `courses/${courseId}/files`);

// Channel functions
export const createChannel = async (channelData: { name: string; description?: string; createdBy: string; type?: 'text' | 'voice' | 'whiteboard' }) => {
  return await addDoc(channelsCollection, {
    ...channelData,
    type: channelData.type || 'text',
    createdAt: Date.now()
  });
};

export const subscribeToChannels = (callback: (channels: any[]) => void) => {
  const q = query(channelsCollection, orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const channels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(channels);
  });
};

// Message functions
export const sendMessage = async (channelId: string, message: {
  username: string;
  avatar: string;
  text?: string;
  imageUrl?: string;
  gifUrl?: string;
  timestamp: number;
  type: 'text' | 'image' | 'gif' | 'break';
}) => {
  if (!channelId) {
    throw new Error('Channel ID is required');
  }
  try {
    const channelMessagesRef = messagesCollection(channelId);
    return await addDoc(channelMessagesRef, message);
  } catch (error) {
    console.error('Firebase sendMessage error:', error);
    throw error;
  }
};

export const subscribeToMessages = (channelId: string, callback: (messages: any[]) => void) => {
  if (!channelId) return () => {};
  const channelMessagesRef = messagesCollection(channelId);
  const q = query(channelMessagesRef, orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
};

export const clearAllMessages = async (channelId: string) => {
  if (!channelId) return;
  const channelMessagesRef = messagesCollection(channelId);
  const q = query(channelMessagesRef);
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

// Storage functions
export const uploadImage = async (file: File): Promise<string> => {
  const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

export const uploadFile = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

// Course functions
export const createCourse = async (courseData: { name: string; description?: string; createdBy: string }) => {
  return await addDoc(coursesCollection, {
    ...courseData,
    createdAt: Date.now()
  });
};

export const subscribeToCourses = (callback: (courses: any[]) => void) => {
  const q = query(coursesCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const courses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(courses);
  });
};

export const addFileToCourse = async (courseId: string, fileData: { name: string; url: string; type: string; uploadedBy: string }) => {
  const filesRef = courseFilesCollection(courseId);
  return await addDoc(filesRef, {
    ...fileData,
    uploadedAt: Date.now()
  });
};

export const subscribeToCourseFiles = (courseId: string, callback: (files: any[]) => void) => {
  const filesRef = courseFilesCollection(courseId);
  const q = query(filesRef, orderBy('uploadedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const files = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(files);
  });
};

// Whiteboard functions
export const addWhiteboardStroke = async (channelId: string, stroke: {
  points: Array<{ x: number; y: number }>;
  color: string;
  lineWidth: number;
  tool: 'pen' | 'eraser';
  username: string;
  timestamp: number;
}) => {
  const strokesRef = whiteboardStrokesCollection(channelId);
  return await addDoc(strokesRef, stroke);
};

export const subscribeToWhiteboard = (channelId: string, callback: (strokes: any[]) => void) => {
  if (!channelId) return () => {};
  const strokesRef = whiteboardStrokesCollection(channelId);
  const q = query(strokesRef, orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const strokes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(strokes);
  });
};

export const clearWhiteboard = async (channelId: string) => {
  if (!channelId) return;
  const strokesRef = whiteboardStrokesCollection(channelId);
  const q = query(strokesRef);
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  return await batch.commit();
};

export { db, storage };
