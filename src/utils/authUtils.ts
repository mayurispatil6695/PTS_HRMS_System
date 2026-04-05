import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { ref, set, get, remove } from "firebase/database";
import { auth, database } from "../firebase";

// =============================
// 🔹 ADMIN SIGNUP
// =============================
export const signupAdmin = async (
  name: string,
  email: string,
  password: string
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = userCredential.user.uid;

    await set(ref(database, `users/${uid}/profile`), {
      name,
      email,
      role: "admin",
      createdAt: new Date().toISOString()
    });

    return { success: true, uid };
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") {
      throw new Error("Email already exists");
    }
    throw error;
  }
};

// =============================
// 🔹 ADMIN LOGIN
// =============================
export const loginAdmin = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = userCredential.user.uid;

    const snapshot = await get(ref(database, `users/${uid}/profile`));

    if (!snapshot.exists()) {
      throw new Error("User data not found");
    }

    const userData = snapshot.val();

    if (userData.role !== "admin") {
      throw new Error("Access denied. Not an admin.");
    }

    return { success: true, user: userData };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// =============================
// 🔹 GENERATE OTP
// =============================
export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// =============================
// 🔹 STORE OTP IN FIREBASE
// =============================
export const storeOtpData = async (email: string, otp: string) => {
  await set(ref(database, `otp/${email.replace(".", "_")}`), {
    otp,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 min
  });
};

// =============================
// 🔹 GET OTP FROM FIREBASE
// =============================
export const getStoredOtpData = async (email: string) => {
  const snapshot = await get(
    ref(database, `otp/${email.replace(".", "_")}`)
  );

  return snapshot.exists() ? snapshot.val() : null;
};

// =============================
// 🔹 CLEAR OTP
// =============================
export const clearOtpData = async (email: string) => {
  await remove(ref(database, `otp/${email.replace(".", "_")}`));
};