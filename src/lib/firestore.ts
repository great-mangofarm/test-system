import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'
import type { Product, TestSuite, TestCase } from '@/types'

// --- Products ---
export async function getProducts(): Promise<Product[]> {
  const snap = await getDocs(collection(db, 'products'))
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product))
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'products'), { ...data, createdAt: new Date().toISOString() })
  return ref.id
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  await updateDoc(doc(db, 'products', id), data)
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id))
}

// --- Test Suites ---
export async function getSuites(productId: string): Promise<TestSuite[]> {
  const snap = await getDocs(
    query(collection(db, 'suites'), where('productId', '==', productId))
  )
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestSuite))
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createSuite(data: Omit<TestSuite, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'suites'), { ...data, createdAt: new Date().toISOString() })
  return ref.id
}

export async function updateSuite(id: string, data: Partial<TestSuite>): Promise<void> {
  await updateDoc(doc(db, 'suites', id), data)
}

export async function deleteSuite(id: string): Promise<void> {
  await deleteDoc(doc(db, 'suites', id))
}

// --- Test Cases ---
export async function getTestCases(suiteId: string): Promise<TestCase[]> {
  const snap = await getDocs(
    query(collection(db, 'testcases'), where('suiteId', '==', suiteId))
  )
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestCase))
  return docs.sort((a, b) => a.order - b.order)
}

export async function createTestCase(data: Omit<TestCase, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'testcases'), data)
  return ref.id
}

export async function updateTestCase(id: string, data: Partial<TestCase>): Promise<void> {
  await updateDoc(doc(db, 'testcases', id), { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteTestCase(id: string): Promise<void> {
  await deleteDoc(doc(db, 'testcases', id))
}

export async function bulkCreateTestCases(cases: Omit<TestCase, 'id'>[]): Promise<void> {
  await Promise.all(cases.map((c) => addDoc(collection(db, 'testcases'), c)))
}

// --- Image Upload ---
export async function uploadImage(file: File, suiteId: string): Promise<string> {
  const storageRef = ref(storage, `test-images/${suiteId}/${Date.now()}_${file.name}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function deleteImage(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch {
    // ignore if already deleted
  }
}
