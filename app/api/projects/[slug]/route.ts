import { act, readProject, saveProject } from '@/lib/projects/server'
type Context={params:Promise<{slug:string}>}
export async function GET(request:Request,{params}:Context){return readProject(request,(await params).slug)}
export async function PUT(request:Request,{params}:Context){return saveProject(request,(await params).slug)}
export async function POST(request:Request,{params}:Context){return act(request,(await params).slug)}
