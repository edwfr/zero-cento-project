'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { Bold, Check, Columns3, Italic, Minus, Palette, Plus, RemoveFormatting, Rows3, Table2, Trash2 } from 'lucide-react'

interface TraineeNotesEditorProps {
    value: JSONContent
    onChange: (document: JSONContent) => void
    disabled?: boolean
    labels: {
        clearFormatting: string
        italic: string
        bold: string
        color: string
        colorRemove: string
        insertTable: string
        addRow: string
        removeRow: string
        addColumn: string
        removeColumn: string
        removeTable: string
    }
}

const COLOR_SWATCHES = ['#111827', '#DC2626', '#F97316', '#16A34A', '#2563EB', '#7C3AED']

interface ToolbarButtonProps {
    label: string
    icon: React.ReactNode
    disabled?: boolean
    active?: boolean
    onExecute: () => void
}

function ToolbarButton({ label, icon, disabled, active, onExecute }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={active ? true : undefined}
            title={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onExecute}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
            }`}
        >
            <span className="pointer-events-none [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        </button>
    )
}

interface ColorPickerProps {
    editor: Editor
    disabled: boolean
    label: string
    removeLabel: string
}

function ColorPicker({ editor, disabled, label, removeLabel }: ColorPickerProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const currentColor = (editor.getAttributes('textStyle').color as string | undefined) ?? null

    useEffect(() => {
        if (!open) return
        function onDocumentMouseDown(event: MouseEvent) {
            if (!containerRef.current) return
            if (!containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', onDocumentMouseDown)
        return () => document.removeEventListener('mousedown', onDocumentMouseDown)
    }, [open])

    const applyColor = (color: string) => {
        editor.chain().focus().setColor(color).run()
        setOpen(false)
    }

    const clearColor = () => {
        editor.chain().focus().unsetColor().run()
        setOpen(false)
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                title={label}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setOpen((current) => !current)}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Palette className="h-4 w-4" aria-hidden="true" />
                <span
                    className="inline-block h-4 w-4 rounded border border-gray-300"
                    style={{ backgroundColor: currentColor ?? '#FFFFFF' }}
                    aria-hidden="true"
                />
            </button>
            {open && (
                <div
                    role="listbox"
                    aria-label={label}
                    className="absolute left-0 top-full z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
                >
                    <div className="grid grid-cols-6 gap-2">
                        {COLOR_SWATCHES.map((swatch) => {
                            const isActive = currentColor?.toLowerCase() === swatch.toLowerCase()
                            return (
                                <button
                                    key={swatch}
                                    type="button"
                                    role="option"
                                    aria-selected={isActive}
                                    aria-label={swatch}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => applyColor(swatch)}
                                    className="relative flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                                    style={{ backgroundColor: swatch }}
                                >
                                    {isActive && <Check className="h-3 w-3 text-white drop-shadow" />}
                                </button>
                            )
                        })}
                    </div>
                    <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={clearColor}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                    >
                        {removeLabel}
                    </button>
                </div>
            )}
        </div>
    )
}

export default function TraineeNotesEditor({ value, onChange, disabled = false, labels }: TraineeNotesEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: false,
                blockquote: false,
                codeBlock: false,
                code: false,
                strike: false,
                horizontalRule: false,
            }),
            TextStyle,
            Color,
            Table.configure({ resizable: false, allowTableNodeSelection: true }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value,
        editable: !disabled,
        editorProps: {
            attributes: {
                class: 'min-h-[18rem] px-4 py-3 text-gray-900 focus:outline-none',
            },
        },
        onUpdate: ({ editor: updatedEditor }) => onChange(updatedEditor.getJSON()),
    })

    useEffect(() => {
        if (!editor) return
        editor.setEditable(!disabled)
    }, [disabled, editor])

    useEffect(() => {
        if (!editor) return
        if (JSON.stringify(editor.getJSON()) === JSON.stringify(value)) return
        editor.commands.setContent(value, { emitUpdate: false })
    }, [editor, value])

    const [, forceToolbarUpdate] = useReducer((tick: number) => tick + 1, 0)

    useEffect(() => {
        if (!editor) return
        editor.on('selectionUpdate', forceToolbarUpdate)
        editor.on('transaction', forceToolbarUpdate)
        return () => {
            editor.off('selectionUpdate', forceToolbarUpdate)
            editor.off('transaction', forceToolbarUpdate)
        }
    }, [editor])

    if (!editor) {
        return <div className="h-80 animate-pulse rounded-lg border border-gray-200 bg-gray-100" aria-busy="true" />
    }

    const insideTable = editor.isActive('table')
    const hasBold = editor.isActive('bold')
    const hasItalic = editor.isActive('italic')
    const boldActive = hasBold && !hasItalic
    const italicActive = hasItalic && !hasBold
    const normalActive = !hasBold && !hasItalic

    const setNormalStyle = () => editor.chain().focus().unsetBold().unsetItalic().run()

    const applyItalic = () => {
        const chain = editor.chain().focus().unsetBold()
        if (hasItalic) {
            chain.unsetItalic()
        } else {
            chain.setItalic()
        }
        chain.run()
    }

    const applyBold = () => {
        const chain = editor.chain().focus().unsetItalic()
        if (hasBold) {
            chain.unsetBold()
        } else {
            chain.setBold()
        }
        chain.run()
    }

    return (
        <div className="overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 p-2">
                <ToolbarButton
                    label={labels.clearFormatting}
                    icon={<RemoveFormatting />}
                    active={normalActive}
                    disabled={disabled}
                    onExecute={setNormalStyle}
                />
                <ToolbarButton
                    label={labels.italic}
                    icon={<Italic />}
                    active={italicActive}
                    disabled={disabled}
                    onExecute={applyItalic}
                />
                <ToolbarButton
                    label={labels.bold}
                    icon={<Bold />}
                    active={boldActive}
                    disabled={disabled}
                    onExecute={applyBold}
                />
                <ColorPicker editor={editor} disabled={disabled} label={labels.color} removeLabel={labels.colorRemove} />
                <div className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />
                <ToolbarButton
                    label={labels.insertTable}
                    icon={<Table2 />}
                    disabled={disabled}
                    onExecute={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                />
                <ToolbarButton
                    label={labels.addRow}
                    icon={<Plus />}
                    disabled={disabled || !insideTable}
                    onExecute={() => editor.chain().focus().addRowAfter().run()}
                />
                <ToolbarButton
                    label={labels.removeRow}
                    icon={<Minus />}
                    disabled={disabled || !insideTable}
                    onExecute={() => editor.chain().focus().deleteRow().run()}
                />
                <ToolbarButton
                    label={labels.addColumn}
                    icon={<Columns3 />}
                    disabled={disabled || !insideTable}
                    onExecute={() => editor.chain().focus().addColumnAfter().run()}
                />
                <ToolbarButton
                    label={labels.removeColumn}
                    icon={<Rows3 />}
                    disabled={disabled || !insideTable}
                    onExecute={() => editor.chain().focus().deleteColumn().run()}
                />
                <ToolbarButton
                    label={labels.removeTable}
                    icon={<Trash2 />}
                    disabled={disabled || !insideTable}
                    onExecute={() => editor.chain().focus().deleteTable().run()}
                />
            </div>
            <EditorContent
                editor={editor}
                className="[&_.ProseMirror]:min-h-[18rem] [&_.ProseMirror_table]:my-4 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:min-w-24 [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:align-top [&_.ProseMirror_th]:min-w-24 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:bg-gray-100 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_.selectedCell]:bg-brand-primary/15"
            />
        </div>
    )
}
