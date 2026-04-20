/**
 * AnZhiYu
 * mermaid
 * https://github.com/mermaid-js/mermaid
 */

'use strict'

const { escapeHTML } = require('hexo-util')
const DOLLAR_PLACEHOLDER = '__ANZHIYU_MERMAID_DOLLAR__'

function mermaid (args, content) {
  const source = escapeHTML(content).replace(new RegExp(DOLLAR_PLACEHOLDER, 'g'), '&#36;')

  return `<div class="mermaid-wrap"><pre class="mermaid-src" hidden>
  ${source}
  </pre></div>`
}

hexo.extend.tag.register('mermaid', mermaid, { ends: true })
