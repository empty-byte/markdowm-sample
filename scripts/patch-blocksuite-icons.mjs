import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const target = new URL('../node_modules/@blocksuite/icons/dist/lit.mjs', import.meta.url)

async function patchIconsFile() {
  if (!existsSync(target)) {
    console.warn('[patch-blocksuite-icons] skip: file not found')
    return
  }

  const content = await readFile(target, 'utf8')
  if (content.includes('CheckBoxCkeckSolidIcon')) {
    console.log('[patch-blocksuite-icons] already patched')
    return
  }

  const needle = '  CheckBoxCheckSolid as CheckBoxCheckSolidIcon,'
  if (!content.includes(needle)) {
    console.warn('[patch-blocksuite-icons] skip: export needle not found')
    return
  }

  const patched = content.replace(
    needle,
    `${needle}\n  CheckBoxCheckSolid as CheckBoxCkeckSolidIcon,`
  )

  await writeFile(target, patched, 'utf8')
  console.log('[patch-blocksuite-icons] patched successfully')
}

await patchIconsFile()
