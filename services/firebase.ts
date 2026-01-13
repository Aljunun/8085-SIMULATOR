import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, getDocs, writeBatch, doc, setDoc, getDoc } from "firebase/firestore";
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
const auth = getAuth(app);
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
  mentions?: string[];
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

export const addReaction = async (channelId: string, messageId: string, emoji: string, username: string) => {
  if (!channelId || !messageId) return;
  const messageRef = doc(db, `channels/${channelId}/messages/${messageId}`);
  const messageDoc = await getDoc(messageRef);
  
  if (messageDoc.exists()) {
    const messageData = messageDoc.data();
    const reactions = messageData.reactions || {};
    const emojiReactions = reactions[emoji] || [];
    
    if (!emojiReactions.includes(username)) {
      emojiReactions.push(username);
    } else {
      // Remove reaction if already exists (toggle)
      const index = emojiReactions.indexOf(username);
      emojiReactions.splice(index, 1);
      if (emojiReactions.length === 0) {
        delete reactions[emoji];
      }
    }
    
    await setDoc(messageRef, { reactions }, { merge: true });
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
  }, { includeMetadataChanges: false }); // Don't trigger on metadata changes
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

// Auth functions
export const signUp = async (email: string, password: string, username: string, avatar: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Only update photoURL if it's not a base64 string (too long for Firebase Auth)
  const photoURL = avatar && !avatar.startsWith('data:') ? avatar : undefined;
  
  // Update profile with display name
  await updateProfile(user, {
    displayName: username,
    photoURL: photoURL
  });
  
  // Save user data to Firestore (can store base64 here)
  await setDoc(doc(db, 'users', user.uid), {
    username: username,
    avatar: avatar,
    email: email,
    createdAt: Date.now()
  });
  
  return user;
};

export const signIn = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logOut = async () => {
  return await signOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// User functions
export const getUserProfile = async (userId: string) => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (userDoc.exists()) {
    return userDoc.data();
  }
  return null;
};

export const updateUserProfile = async (userId: string, userData: { username?: string; avatar?: string }) => {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    ...userData,
    updatedAt: Date.now()
  }, { merge: true });
  
  // Update auth profile if needed (only if avatar is not base64)
  if (auth.currentUser) {
    const photoURL = userData.avatar && !userData.avatar.startsWith('data:') 
      ? userData.avatar 
      : auth.currentUser.photoURL || undefined;
    
    await updateProfile(auth.currentUser, {
      displayName: userData.username || auth.currentUser.displayName || undefined,
      photoURL: photoURL
    });
  }
};

export const saveUser = async (userId: string, userData: { username: string; avatar: string }) => {
  const userRef = doc(db, 'users', userId);
  return await setDoc(userRef, {
    userId: userId,
    ...userData,
    createdAt: Date.now()
  }, { merge: true });
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
  }, { includeMetadataChanges: false }); // Don't trigger on metadata changes
};

// PDF drawing functions
const pdfDrawingsCollection = (pdfId: string) => collection(db, `pdfDrawings/${pdfId}/strokes`);

export const addPdfStroke = async (pdfId: string, stroke: {
  points: Array<{ x: number; y: number }>;
  color: string;
  lineWidth: number;
  tool: 'pen' | 'eraser';
  username: string;
  timestamp: number;
}) => {
  const strokesRef = pdfDrawingsCollection(pdfId);
  return await addDoc(strokesRef, stroke);
};

export const subscribeToPdfDrawings = (pdfId: string, callback: (strokes: any[]) => void) => {
  if (!pdfId) return () => {};
  const strokesRef = pdfDrawingsCollection(pdfId);
  const q = query(strokesRef, orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const strokes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(strokes);
  }, { includeMetadataChanges: false }); // Don't trigger on metadata changes
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

export { db, storage, auth };
