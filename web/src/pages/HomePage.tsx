import { FileText, Table2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HomePage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Welcome to mindbase</CardTitle>
          <CardDescription>
            Local-first notes with Markdown, CSV databases, and attachments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <FileText className="size-4" /> Notes stored as Markdown
            </li>
            <li className="flex items-center gap-2">
              <Table2 className="size-4" /> Databases stored as CSV
            </li>
            <li>Attachments live beside each note</li>
            <li>Rich editor powered by Lexical + shadcn/ui</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Choose a note or database from the sidebar, or create a new one.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
