export type UserRole = 'admin' | 'developer' | 'viewer'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  createdAt: string
}

export type SuiteType = 'qa' | 'dev'

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type TestStatus = 'pass' | 'fail' | 'blocked' | 'not_tested'
export type ProcessingStatus = 'pending' | 'in_progress' | 'resolved' | 'wont_fix'

export interface Product {
  id: string
  name: string
  description: string
  order: number
  createdAt: string
}

export interface TestSuite {
  id: string
  productId: string
  name: string
  version: string
  type: SuiteType
  order: number
  createdAt: string
}

export interface TestCase {
  id: string
  suiteId: string
  productId: string
  area: string
  title: string
  steps: string
  expectedResult: string
  actualResult: string
  status: TestStatus
  processingStatus: ProcessingStatus
  ticketLink: string
  developerNote: string
  images: string[]
  tester: string
  assignedDeveloper: string
  priority: Priority
  order: number
  createdAt: string
  updatedAt: string
}
