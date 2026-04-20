/**
 * Keep hexo-filter-katex from parsing dollar signs inside mermaid tags.
 */

'use strict'

const DOLLAR_PLACEHOLDER = '__ANZHIYU_MERMAID_DOLLAR__'
const MERMAID_BLOCK = /({%\s*mermaid(?:\s+[^%]*)?%})([\s\S]*?)({%\s*endmermaid\s*%})/g

hexo.extend.filter.register('before_post_render', data => {
  data.content = data.content.replace(MERMAID_BLOCK, (match, open, content, close) => {
    return open + content.replace(/\$/g, DOLLAR_PLACEHOLDER) + close
  })
}, 8)
