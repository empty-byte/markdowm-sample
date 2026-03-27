export type CommandAction =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'blockquote'
  | 'codeBlock'
  | 'divider'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'clearMarks'
  | 'undo'
  | 'redo'

export interface CommandMenuItem {
  id: string
  label: string
  description: string
  keywords: string
  action: CommandAction
  group: '基础' | '结构' | '样式' | '编辑'
}

export const commandMenuItems: CommandMenuItem[] = [
  {
    id: 'paragraph',
    label: '文本',
    description: '切换为普通正文段落',
    keywords: '文本 paragraph p 正文',
    action: 'paragraph',
    group: '基础',
  },
  {
    id: 'h1',
    label: '一级标题',
    description: '切换为一级标题',
    keywords: '标题 h1 heading title',
    action: 'h1',
    group: '基础',
  },
  {
    id: 'h2',
    label: '二级标题',
    description: '切换为二级标题',
    keywords: '标题 h2 heading title',
    action: 'h2',
    group: '基础',
  },
  {
    id: 'h3',
    label: '三级标题',
    description: '切换为三级标题',
    keywords: '标题 h3 heading title',
    action: 'h3',
    group: '基础',
  },
  {
    id: 'bullet',
    label: '无序列表',
    description: '切换项目符号列表',
    keywords: '列表 bullet list ul',
    action: 'bullet',
    group: '结构',
  },
  {
    id: 'ordered',
    label: '有序列表',
    description: '切换数字列表',
    keywords: '列表 ordered list ol',
    action: 'ordered',
    group: '结构',
  },
  {
    id: 'task',
    label: '任务列表',
    description: '切换任务清单（可勾选）',
    keywords: '任务 checklist todo task',
    action: 'task',
    group: '结构',
  },
  {
    id: 'blockquote',
    label: '引用块',
    description: '切换引用块样式',
    keywords: '引用 quote blockquote',
    action: 'blockquote',
    group: '结构',
  },
  {
    id: 'codeBlock',
    label: '代码块',
    description: '插入或切换代码块',
    keywords: '代码 code block',
    action: 'codeBlock',
    group: '结构',
  },
  {
    id: 'divider',
    label: '分割线',
    description: '插入水平分割线',
    keywords: '分割线 divider hr line',
    action: 'divider',
    group: '结构',
  },
  {
    id: 'bold',
    label: '粗体',
    description: '切换粗体格式',
    keywords: '粗体 bold strong',
    action: 'bold',
    group: '样式',
  },
  {
    id: 'italic',
    label: '斜体',
    description: '切换斜体格式',
    keywords: '斜体 italic em',
    action: 'italic',
    group: '样式',
  },
  {
    id: 'strike',
    label: '删除线',
    description: '切换删除线格式',
    keywords: '删除线 strike through',
    action: 'strike',
    group: '样式',
  },
  {
    id: 'clearMarks',
    label: '清除样式',
    description: '移除当前选区的文本样式',
    keywords: '清除 样式 clear format marks',
    action: 'clearMarks',
    group: '样式',
  },
  {
    id: 'undo',
    label: '撤销',
    description: '撤销上一步操作',
    keywords: '撤销 undo back',
    action: 'undo',
    group: '编辑',
  },
  {
    id: 'redo',
    label: '重做',
    description: '重做上一步撤销',
    keywords: '重做 redo forward',
    action: 'redo',
    group: '编辑',
  },
]

export function filterCommands(query: string): CommandMenuItem[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return commandMenuItems

  return commandMenuItems.filter((item) => {
    const text = `${item.label} ${item.description} ${item.keywords}`.toLowerCase()
    return text.includes(normalized)
  })
}
