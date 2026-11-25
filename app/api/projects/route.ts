import { saveProject } from '@/lib/projects/server'
export async function POST(request:Request){return saveProject(request)}
