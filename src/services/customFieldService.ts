import api from './api'

export interface CustomField {
  id: number
  name: string
  description: string
  icon: string
  fieldType: string
  required: boolean
  context: string
  sortOrder: number
  options?: string[]
}

export const customFieldService = {
  async getAll(): Promise<CustomField[]> {
    const res = await api.get('/api/v1/custom-fields')
    return (res.data as any).data ?? res.data
  },
}
