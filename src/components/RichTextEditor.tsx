import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, List, ListOrdered,
  Heading1, Heading2, Heading3, Minus,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (html: string) => void
  onBlur?: (html: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
}

function ToolbarButton({
  active, onClick, children, title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors',
        active && 'bg-slate-200 text-slate-800',
      )}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({ value, onChange, onBlur, placeholder, className, readOnly = false }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '내용을 입력하세요...',
      }),
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
    onBlur: ({ editor }) => {
      if (!onBlur) return
      const html = editor.getHTML()
      onBlur(html === '<p></p>' ? '' : html)
    },
  })

  // 외부에서 value가 바뀔 때만 동기화 (다른 레코드 열기/초기 로딩 등).
  // 사용자가 편집 중(포커스/한글 IME 조합 중)이면 절대 setContent 하지 않음 →
  // 입력 박자보다 늦게 도착한 value가 조합을 깨뜨리던 문제(자음 씹힘·중복·되돌림) 방지.
  useEffect(() => {
    if (!editor || editor.isFocused) return
    const current = editor.getHTML()
    const normalizedCurrent = current === '<p></p>' ? '' : current
    if (normalizedCurrent !== (value ?? '')) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (readOnly) {
    return (
      <div
        className={cn(
          'prose prose-sm max-w-none text-slate-700 leading-relaxed break-words [overflow-wrap:anywhere]',
          'prose-headings:font-semibold prose-headings:text-slate-800',
          'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5',
          '[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm',
          className,
        )}
        dangerouslySetInnerHTML={{ __html: value || '<span class="text-slate-300">—</span>' }}
      />
    )
  }

  return (
    <div className={cn('border rounded-md overflow-hidden bg-white', className)}>
      {/* 툴바 */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-slate-50 flex-wrap">
        <ToolbarButton
          title="굵게 (Ctrl+B)"
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="기울임 (Ctrl+I)"
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton
          title="제목 1"
          active={editor?.isActive('heading', { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="제목 2"
          active={editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="제목 3"
          active={editor?.isActive('heading', { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton
          title="불릿 리스트"
          active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="번호 리스트"
          active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton
          title="구분선"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* 에디터 영역 */}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm max-w-none px-3 py-2 min-h-[120px] focus-within:ring-2 focus-within:ring-primary/30',
          'prose-headings:font-semibold prose-headings:text-slate-800',
          'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5',
          '[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm',
          '[&_.tiptap]:outline-none [&_.tiptap]:min-h-[100px]',
          '[&_.tiptap]:break-words [&_.tiptap]:[overflow-wrap:anywhere]',
          '[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ul]:my-1',
          '[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ol]:my-1',
          '[&_.tiptap_li]:my-0.5',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:text-slate-400',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
        )}
      />
    </div>
  )
}
