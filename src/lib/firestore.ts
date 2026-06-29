import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Product, TestSuite, TestCase, UserProfile, DeployBatch, QaGroup, QaCheck } from '@/types'

// --- Users ---
export async function getUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => d.data() as UserProfile).sort((a, b) => a.displayName.localeCompare(b.displayName))
}

// --- Products ---
export async function getProducts(): Promise<Product[]> {
  const snap = await getDocs(collection(db, 'products'))
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product))
  return docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt))
}

export async function createProduct(data: Omit<Product, 'id' | 'createdAt' | 'order'>, order: number): Promise<string> {
  const ref = await addDoc(collection(db, 'products'), { ...data, order, createdAt: new Date().toISOString() })
  return ref.id
}

export async function reorderProducts(ids: string[]): Promise<void> {
  const batch = writeBatch(db)
  ids.forEach((id, i) => batch.update(doc(db, 'products', id), { order: i }))
  await batch.commit()
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
  return docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt))
}

export async function createSuite(data: Omit<TestSuite, 'id' | 'createdAt' | 'order'>, order: number): Promise<string> {
  const ref = await addDoc(collection(db, 'suites'), { ...data, order, createdAt: new Date().toISOString() })
  return ref.id
}

export async function reorderSuites(ids: string[]): Promise<void> {
  const batch = writeBatch(db)
  ids.forEach((id, i) => batch.update(doc(db, 'suites', id), { order: i }))
  await batch.commit()
}

export async function updateSuite(id: string, data: Partial<TestSuite>): Promise<void> {
  await updateDoc(doc(db, 'suites', id), data)
}

export async function deleteSuite(id: string): Promise<void> {
  await deleteDoc(doc(db, 'suites', id))
}

// --- Deploy Batches (배포묶음) ---
export async function getDeployBatches(suiteId: string): Promise<DeployBatch[]> {
  const snap = await getDocs(
    query(collection(db, 'deployBatches'), where('suiteId', '==', suiteId))
  )
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeployBatch))
  // 예정일 내림차순(최근 배포가 위), 동일하면 order
  return docs.sort((a, b) =>
    (b.deployDate ?? '').localeCompare(a.deployDate ?? '') || (a.order ?? 0) - (b.order ?? 0)
  )
}

export async function createDeployBatch(
  data: Omit<DeployBatch, 'id' | 'createdAt' | 'order'>,
  order: number
): Promise<string> {
  const ref = await addDoc(collection(db, 'deployBatches'), { ...data, order, createdAt: new Date().toISOString() })
  return ref.id
}

export async function updateDeployBatch(id: string, data: Partial<DeployBatch>): Promise<void> {
  await updateDoc(doc(db, 'deployBatches', id), data)
}

export async function deleteDeployBatch(id: string): Promise<void> {
  await deleteDoc(doc(db, 'deployBatches', id))
}

// --- QA Groups (배포예정 기능별 QA 테스트 묶음) ---
export async function getQaGroups(productId: string): Promise<QaGroup[]> {
  const snap = await getDocs(query(collection(db, 'qaGroups'), where('productId', '==', productId)))
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QaGroup))
  return docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt))
}
export async function createQaGroup(data: Omit<QaGroup, 'id' | 'createdAt' | 'order'>, order: number): Promise<string> {
  const ref = await addDoc(collection(db, 'qaGroups'), { ...data, order, createdAt: new Date().toISOString() })
  return ref.id
}
export async function updateQaGroup(id: string, data: Partial<QaGroup>): Promise<void> {
  await updateDoc(doc(db, 'qaGroups', id), data)
}
export async function deleteQaGroup(id: string): Promise<void> {
  // 묶음 삭제 시 하위 체크 항목도 함께 삭제
  const snap = await getDocs(query(collection(db, 'qaChecks'), where('groupId', '==', id)))
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'qaGroups', id))
  await batch.commit()
}

// --- QA Checks (QA 체크 항목) ---
export async function getQaChecks(groupId: string): Promise<QaCheck[]> {
  const snap = await getDocs(query(collection(db, 'qaChecks'), where('groupId', '==', groupId)))
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QaCheck))
  return docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt))
}
export async function createQaCheck(data: Omit<QaCheck, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'qaChecks'), { ...data, createdAt: new Date().toISOString() })
  return ref.id
}
export async function updateQaCheck(id: string, data: Partial<QaCheck>): Promise<void> {
  await updateDoc(doc(db, 'qaChecks', id), data)
}
export async function deleteQaCheck(id: string): Promise<void> {
  await deleteDoc(doc(db, 'qaChecks', id))
}

// --- Test Cases ---
export async function getTestCase(id: string): Promise<TestCase | null> {
  const snap = await getDoc(doc(db, 'testcases', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as TestCase
}

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

export interface AreaStat {
  total: number
  pass: number
  fail: number
  blocked: number
  notTested: number
  resolved: number
}

export interface SuiteStats {
  total: number
  pass: number
  fail: number
  blocked: number
  notTested: number
  resolved: number
  areas: Array<{ name: string } & AreaStat>
}

export async function getSuiteStats(suiteId: string): Promise<SuiteStats> {
  const snap = await getDocs(
    query(collection(db, 'testcases'), where('suiteId', '==', suiteId))
  )
  const docs = snap.docs.map((d) => d.data() as TestCase)

  // 영역별 집계
  const areaMap = new Map<string, AreaStat>()
  for (const c of docs) {
    const key = c.area || '(미분류)'
    if (!areaMap.has(key)) areaMap.set(key, { total: 0, pass: 0, fail: 0, blocked: 0, notTested: 0, resolved: 0 })
    const a = areaMap.get(key)!
    a.total++
    if (c.status === 'pass') a.pass++
    else if (c.status === 'fail') a.fail++
    else if (c.status === 'blocked') a.blocked++
    else a.notTested++
    if (c.processingStatus === 'resolved') a.resolved++
  }

  return {
    total: docs.length,
    pass: docs.filter((c) => c.status === 'pass').length,
    fail: docs.filter((c) => c.status === 'fail').length,
    blocked: docs.filter((c) => c.status === 'blocked').length,
    notTested: docs.filter((c) => c.status === 'not_tested').length,
    resolved: docs.filter((c) => c.processingStatus === 'resolved').length,
    areas: Array.from(areaMap.entries()).map(([name, stat]) => ({ name, ...stat })),
  }
}

// --- Image Upload (Cloudinary) ---
const CLOUDINARY_CLOUD_NAME = 'drz0oj86f'
const CLOUDINARY_UPLOAD_PRESET = 'issue_tracker'

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? '이미지 업로드 실패')
  return data.secure_url
}

export async function deleteImage(url: string): Promise<void> {
  // Cloudinary 이미지 삭제는 서버사이드 서명이 필요하므로 클라이언트에서는 생략
  console.log('deleteImage skipped (Cloudinary):', url)
}
