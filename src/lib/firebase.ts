import { initializeApp } from 'firebase/app';
import { 
  getAuth,
  signInWithPopup,
  GoogleAuthProvider, 
  signInWithCredential, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Sign in with Google with fallback for Web/Extension
export async function signInWithGoogle() {
  // Check if we are in an extension environment and identity is available
  if (typeof chrome !== 'undefined' && chrome.identity) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!token) {
          reject(new Error('No token received'));
          return;
        }
        
        try {
          const tokenString = typeof token === 'string' ? token : (token as any).token;
          const credential = GoogleAuthProvider.credential(null, tokenString);
          const result = await signInWithCredential(auth, credential);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // Fallback to standard Firebase Popup for Web
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error) {
    console.error('Web Sign-in Error:', error);
    throw error;
  }
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null) {
  const user = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: error.message || 'Unknown Firestore error',
    operationType,
    path,
    authInfo: {
      userId: user?.uid || 'unauthenticated',
      email: user?.email || '',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || false,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };
  
  throw new Error(JSON.stringify(errorInfo));
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
