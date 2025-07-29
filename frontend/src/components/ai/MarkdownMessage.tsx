'use client';

import React from 'react';
import styled from 'styled-components';
import URLPreview from './URLPreview';

const MarkdownContainer = styled.div`
  color: rgba(255, 255, 255, 0.9);
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: 1.8;
  
  /* Paragraphs with better spacing */
  p {
    margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
    color: rgba(255, 255, 255, 0.85);
    
    &:last-child {
      margin-bottom: 0;
    }
    
    /* First paragraph often contains the main message */
    &:first-child {
      font-size: 1.05em;
      color: rgba(255, 255, 255, 0.95);
    }
  }
  
  /* Bold text - make it pop with glow effect */
  strong, b {
    color: #FFFFFF;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    text-shadow: 0 0 20px rgba(123, 97, 255, 0.5);
    letter-spacing: 0.02em;
  }
  
  /* Italic text - subtle emphasis */
  em, i {
    color: rgba(224, 214, 255, 0.95);
    font-style: italic;
    letter-spacing: 0.01em;
  }
  
  /* Lists with better styling and icons */
  ul, ol {
    margin: ${({ theme }) => theme.spacing.md} 0;
    padding-left: ${({ theme }) => theme.spacing.xl};
    
    li {
      margin: ${({ theme }) => theme.spacing.sm} 0;
      line-height: 1.7;
      color: rgba(255, 255, 255, 0.85);
      
      /* Custom bullet points */
      &::marker {
        color: ${({ theme }) => theme.colors.primary};
      }
    }
  }
  
  /* Unordered lists with custom bullets */
  ul li {
    position: relative;
    list-style: none;
    padding-left: ${({ theme }) => theme.spacing.md};
    
    &::before {
      content: "▸";
      position: absolute;
      left: 0;
      color: ${({ theme }) => theme.colors.primary};
      font-weight: bold;
      font-size: 1.2em;
    }
  }
  
  /* Enhanced blockquotes */
  blockquote {
    margin: ${({ theme }) => theme.spacing.lg} 0;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    border-left: 4px solid ${({ theme }) => theme.colors.primary};
    background: linear-gradient(135deg, rgba(123, 97, 255, 0.15) 0%, rgba(123, 97, 255, 0.05) 100%);
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    
    p {
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 1.05em;
      font-style: italic;
    }
  }
  
  /* Inline code styling */
  code {
    background: rgba(123, 97, 255, 0.2);
    color: #E0D6FF;
    padding: 3px 8px;
    border-radius: 6px;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.9em;
    border: 1px solid rgba(123, 97, 255, 0.3);
    font-weight: 500;
  }
  
  /* Pre-formatted code blocks */
  pre {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(123, 97, 255, 0.3);
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.lg};
    overflow-x: auto;
    margin: ${({ theme }) => theme.spacing.lg} 0;
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
    
    code {
      background: none;
      border: none;
      padding: 0;
      color: #E0D6FF;
      font-size: 0.95em;
    }
    
    /* Scrollbar styling */
    &::-webkit-scrollbar {
      height: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(123, 97, 255, 0.5);
      border-radius: 4px;
    }
  }
  
  /* Headers with stunning gradients */
  h1, h2, h3, h4, h5, h6 {
    margin: ${({ theme }) => theme.spacing.xl} 0 ${({ theme }) => theme.spacing.md} 0;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    line-height: 1.3;
    letter-spacing: -0.02em;
    
    &:first-child {
      margin-top: 0;
    }
  }
  
  h1 { 
    font-size: 2em;
    background: linear-gradient(135deg, #7B61FF 0%, #E0D6FF 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 2px 20px rgba(123, 97, 255, 0.3);
  }
  
  h2 { 
    font-size: 1.6em;
    color: #E0D6FF;
    border-bottom: 2px solid rgba(123, 97, 255, 0.3);
    padding-bottom: ${({ theme }) => theme.spacing.sm};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  }
  
  h3 { 
    font-size: 1.3em;
    color: #D0C4FF;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    
    &::before {
      content: "◆";
      color: ${({ theme }) => theme.colors.primary};
      font-size: 0.8em;
    }
  }
  
  h4 { 
    font-size: 1.15em;
    color: #C0B4FF;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  
  h5 { 
    font-size: 1.05em;
    color: #B0A4FF;
  }
  
  h6 { 
    font-size: 0.95em;
    color: #A094FF;
  }
  
  /* Horizontal rules */
  hr {
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(123, 97, 255, 0.5), transparent);
    margin: ${({ theme }) => theme.spacing.xl} 0;
  }
  
  /* Links with hover effects */
  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    border-bottom: 1px solid rgba(123, 97, 255, 0.3);
    transition: all 0.2s ease;
    font-weight: 500;
    
    &:hover {
      color: #9B85FF;
      border-bottom-color: #9B85FF;
      text-shadow: 0 0 20px rgba(155, 133, 255, 0.5);
    }
  }
  
  /* Special classes for enhanced formatting */
  
  /* Highlights */
  .highlight {
    background: linear-gradient(135deg, rgba(123, 97, 255, 0.3) 0%, rgba(123, 97, 255, 0.15) 100%);
    padding: 3px 8px;
    border-radius: 6px;
    color: #FFFFFF;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(123, 97, 255, 0.2);
  }
  
  /* Info boxes */
  .info-box {
    background: linear-gradient(135deg, rgba(97, 123, 255, 0.15) 0%, rgba(97, 123, 255, 0.05) 100%);
    border: 1px solid rgba(97, 123, 255, 0.4);
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.lg};
    margin: ${({ theme }) => theme.spacing.lg} 0;
    position: relative;
    overflow: hidden;
    
    &::before {
      content: "ℹ️";
      position: absolute;
      top: ${({ theme }) => theme.spacing.md};
      right: ${({ theme }) => theme.spacing.md};
      font-size: 1.5em;
      opacity: 0.7;
    }
    
    p {
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
    }
  }
  
  /* Warning boxes */
  .warning-box {
    background: linear-gradient(135deg, rgba(255, 184, 97, 0.15) 0%, rgba(255, 184, 97, 0.05) 100%);
    border: 1px solid rgba(255, 184, 97, 0.4);
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.lg};
    margin: ${({ theme }) => theme.spacing.lg} 0;
    position: relative;
    overflow: hidden;
    
    &::before {
      content: "⚠️";
      position: absolute;
      top: ${({ theme }) => theme.spacing.md};
      right: ${({ theme }) => theme.spacing.md};
      font-size: 1.5em;
      opacity: 0.7;
    }
    
    p {
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
    }
  }
  
  /* Success boxes */
  .success-box {
    background: linear-gradient(135deg, rgba(97, 255, 184, 0.15) 0%, rgba(97, 255, 184, 0.05) 100%);
    border: 1px solid rgba(97, 255, 184, 0.4);
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.lg};
    margin: ${({ theme }) => theme.spacing.lg} 0;
    position: relative;
    overflow: hidden;
    
    &::before {
      content: "✅";
      position: absolute;
      top: ${({ theme }) => theme.spacing.md};
      right: ${({ theme }) => theme.spacing.md};
      font-size: 1.5em;
      opacity: 0.7;
    }
    
    p {
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
    }
  }
  
  /* Tables with modern styling */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: ${({ theme }) => theme.spacing.lg} 0;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    
    th, td {
      padding: ${({ theme }) => theme.spacing.md};
      text-align: left;
      border-bottom: 1px solid rgba(123, 97, 255, 0.2);
    }
    
    th {
      background: rgba(123, 97, 255, 0.2);
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      color: #E0D6FF;
      font-size: 0.95em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    tr {
      transition: background 0.2s ease;
      
      &:hover {
        background: rgba(123, 97, 255, 0.05);
      }
      
      &:last-child td {
        border-bottom: none;
      }
    }
    
    td {
      color: rgba(255, 255, 255, 0.85);
    }
  }
  
  /* Special formatting for emojis */
  .emoji {
    font-size: 1.2em;
    margin: 0 0.2em;
  }
  
  /* Definition lists */
  dl {
    margin: ${({ theme }) => theme.spacing.lg} 0;
    
    dt {
      font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
      color: #D0C4FF;
      margin-top: ${({ theme }) => theme.spacing.md};
      font-size: 1.1em;
    }
    
    dd {
      margin-left: ${({ theme }) => theme.spacing.xl};
      margin-bottom: ${({ theme }) => theme.spacing.sm};
      color: rgba(255, 255, 255, 0.85);
    }
  }
`;

interface MarkdownMessageProps {
  content: string;
}

// Enhanced markdown parser with more formatting options
const parseMarkdown = (text: string): { html: string; urlPreviews: string[] } => {
  const urlPreviews: string[] = [];
  
  // Detect standalone URLs for preview - more robust pattern
  const urlRegex = /(?:^|\s)(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)(?:\s|$)/g;
  text = text.replace(urlRegex, (match, url) => {
    // Clean the URL (remove trailing punctuation that might not be part of URL)
    const cleanUrl = url.replace(/[.,;!?]+$/, '');
    urlPreviews.push(cleanUrl);
    return match.replace(url, `||URLPREVIEW:${cleanUrl}||`);
  });
  
  // Also detect URLs that are the entire content (common in AI responses)
  const standaloneUrlRegex = /^(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)$/gm;
  text = text.replace(standaloneUrlRegex, (match, url) => {
    // Clean the URL (remove trailing punctuation that might not be part of URL)
    const cleanUrl = url.replace(/[.,;!?]+$/, '');
    if (!urlPreviews.includes(cleanUrl)) {
      urlPreviews.push(cleanUrl);
    }
    return `||URLPREVIEW:${cleanUrl}||`;
  });
  // Headers (h1-h4)
  text = text.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold text (handle before italic to avoid conflicts)
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic text
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Strikethrough
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Inline code (handle before blocks)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Code blocks
  text = text.replace(/```([^```]+)```/g, '<pre><code>$1</code></pre>');
  
  // Blockquotes
  text = text.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  
  // Horizontal rules
  text = text.replace(/^(---|___|\*\*\*)$/gm, '<hr>');
  
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Special formatting boxes
  text = text.replace(/📘\s*(.+)/g, '<div class="info-box"><p>$1</p></div>');
  text = text.replace(/⚠️\s*(.+)/g, '<div class="warning-box"><p>$1</p></div>');
  text = text.replace(/✅\s*(.+)/g, '<div class="success-box"><p>$1</p></div>');
  
  // Highlights with ==text==
  text = text.replace(/==([^=]+)==/g, '<span class="highlight">$1</span>');
  
  // Numbered lists with proper nesting
  const lines = text.split('\n');
  let inOrderedList = false;
  let processedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    
    if (orderedMatch) {
      if (!inOrderedList) {
        processedLines.push('<ol>');
        inOrderedList = true;
      }
      processedLines.push(`<li>${orderedMatch[2]}</li>`);
    } else {
      if (inOrderedList) {
        processedLines.push('</ol>');
        inOrderedList = false;
      }
      processedLines.push(line);
    }
  }
  
  if (inOrderedList) {
    processedLines.push('</ol>');
  }
  
  text = processedLines.join('\n');
  
  // Bullet points with enhanced styling
  text = text.replace(/^[•▸▹►‣⁃]\s+(.+)$/gm, '<li>$1</li>');
  text = text.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive li elements in ul tags
  text = text.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
  
  // Enhanced emoji handling - simplified for compatibility
  text = text.replace(/(\uD83D[\uDE00-\uDE4F]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\u2600-\u26FF|\u2700-\u27BF)/g, 
    '<span class="emoji">$1</span>');
  
  // Tables (basic support)
  const tableRegex = /(\|.*\|.*\n)+/g;
  text = text.replace(tableRegex, (match) => {
    const rows = match.trim().split('\n');
    let tableHtml = '<table>';
    
    rows.forEach((row, index) => {
      const cells = row.split('|').filter(cell => cell.trim()).map(cell => cell.trim());
      const tag = index === 0 ? 'th' : 'td';
      tableHtml += `<tr>${cells.map(cell => `<${tag}>${cell}</${tag}>`).join('')}</tr>`;
    });
    
    tableHtml += '</table>';
    return tableHtml;
  });
  
  // Convert line breaks to paragraphs (but preserve HTML blocks)
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  text = paragraphs.map(p => {
    // Don't wrap if it's already HTML or a list
    if (p.trim().startsWith('<') || p.includes('<li>') || p.includes('<h') || 
        p.includes('<blockquote>') || p.includes('<table>') || p.includes('<pre>')) {
      return p;
    }
    
    // Handle single line breaks within paragraphs
    const processedP = p.replace(/\n/g, '<br>');
    return `<p>${processedP}</p>`;
  }).join('');
  
  return { html: text, urlPreviews };
};

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  const { html, urlPreviews } = parseMarkdown(content);
  
  // Split content by URL preview markers
  const parts = html.split(/(\|\|URLPREVIEW:https?:\/\/[^\|]+\|\|)/);
  
  return (
    <MarkdownContainer>
      {parts.map((part, index) => {
        if (part.startsWith('||URLPREVIEW:')) {
          // Extract URL from the marker
          const url = part.match(/\|\|URLPREVIEW:([^\|]+)\|\|/)?.[1];
          if (url) {
            return <URLPreview key={index} url={url} />;
          }
        }
        
        // Regular content
        if (part.trim()) {
          return (
            <div
              key={index}
              dangerouslySetInnerHTML={{ __html: part }}
            />
          );
        }
        
        return null;
      })}
    </MarkdownContainer>
  );
};

export default MarkdownMessage; 