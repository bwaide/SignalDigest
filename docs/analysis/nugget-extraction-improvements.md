# Nugget Extraction Analysis & Improvements

## Current Issues

### False Positives (Extracting Ads)
**Problem**: Nebius post-training ad was extracted as a nugget
**Indicators of sponsored content**:
- Header contains "TOGETHER WITH [BRAND]"
- No "Why it matters:" conclusion
- Call-to-action language ("Start now", "Get started", etc.)
- Pricing or promotional offers mentioned

### False Negatives (Missing Valid Nuggets)
**Problem**: "Everything else in AI today" section entirely missed
**Pattern**: Bullet-point lists of news items are being skipped
**Examples missed**:
- IQuest Labs released IQuest-Coder-V1
- LMArena posted 2025 results
- Kimi raised $500M Series C
- SoftBank acquiring DigitalBridge for $4B
- Claude tomato plant experiment

### Duplicate Nuggets
**Problem**: "Instagram's Shift Toward Raw Content" duplicates the main Instagram story
**Pattern**: Creating multiple nuggets from same core story

## Newsletter Structure Pattern

This newsletter (The Rundown AI) follows a consistent structure:

```
1. INTRODUCTION
   - Brief headline/teaser

2. IN TODAY'S AI RUNDOWN (Table of Contents)
   - Bullet list of main topics

3. LATEST DEVELOPMENTS
   - Section A: INSTAGRAM
     - Story headline
     - "The Rundown:" summary
     - "The details:" bullet points
     - "Why it matters:" analysis ✅ EXTRACT THIS

   - Section B: TOGETHER WITH [SPONSOR] ❌ SKIP THIS
     - Sponsored content
     - No "Why it matters:"
     - Contains CTAs and promotional language

   - Section C: DEEPSEEK
     - Story headline
     - "The Rundown:" summary
     - "The details:" bullet points
     - "Why it matters:" analysis ✅ EXTRACT THIS

   - [More sections following same pattern]

4. EVERYTHING ELSE IN AI TODAY ✅ EXTRACT EACH ITEM
   - Bullet list of brief news items
   - Each is 1-2 sentences with a link
   - Company/product name is bolded

5. COMMUNITY / HIGHLIGHTS
   - Community workflows (optional extract)
   - Links to other content (skip)
```

## Improved Extraction Strategy

### Section Classification
1. **Main Story Sections** (high value)
   - Has section header (e.g., "INSTAGRAM", "DEEPSEEK")
   - Contains "Why it matters:" → EXTRACT
   - Does NOT contain "TOGETHER WITH" → validate this

2. **Sponsored Sections** (exclude)
   - Header contains "TOGETHER WITH [BRAND]"
   - No "Why it matters:" conclusion
   - Skip entirely

3. **News Roundup Sections** (medium-high value)
   - "Everything else in AI today"
   - Each bullet point is a separate nugget
   - Extract company name, action, and significance

4. **Metadata Sections** (skip)
   - Community workflows
   - Newsletter links/highlights
   - Sign-offs

### Extraction Rules

**For Main Stories**:
```
title: Story headline (e.g., "IG head says platform must 'evolve fast' due to AI")
description: 1-2 sentence summary from "The Rundown:" or opening paragraph
content: Key points from "The details:" bullets
link: Article/source URL
relevancy_score: 80-100 (main stories are high priority)
tags: Extract from content (e.g., ["Instagram", "Social Media", "AI"])
```

**For "Everything Else" Items**:
```
title: Extract from bold company/product name + action (e.g., "IQuest Labs releases IQuest-Coder-V1")
description: The 1-2 sentence summary provided
content: null (these are brief)
link: Extract embedded URL
relevancy_score: 60-80 (secondary news)
tags: Extract company/technology mentioned
```

**Exclusion Rules**:
- Skip if section header contains "TOGETHER WITH"
- Skip if no "Why it matters:" AND contains promotional CTAs
- Skip community workflows, highlights sections
- Skip table of contents / "In today's rundown" lists

## Recommended Prompt Changes

### Current Prompt Issues
1. ❌ No guidance on sponsored content detection
2. ❌ No instruction to extract from bullet-point news lists
3. ❌ Requests "1-5 key insights" which causes it to skip valuable content
4. ❌ No section-specific extraction strategy

### Improved Prompt Structure

```
You are an AI assistant that extracts key insights (nuggets) from newsletter emails.

IMPORTANT EXCLUSIONS:
1. Skip any section with "TOGETHER WITH [BRAND]" in the header - these are sponsored ads
2. Skip sections without "Why it matters:" that contain promotional language
3. Skip community workflows, newsletter highlights, and sign-offs

EXTRACTION STRATEGY:
Analyze the email structure and extract nuggets from these sections:

1. MAIN STORIES (Priority: High)
   - Look for sections with topic headers (e.g., "INSTAGRAM", "DEEPSEEK", "OPENAI")
   - Each should have "Why it matters:" analysis
   - Extract title, summary, key details, and the "Why it matters" analysis
   - Use relevancy_score: 80-100

2. NEWS ROUNDUP SECTIONS (Priority: Medium-High)
   - Look for "Everything else in [topic]" sections
   - These contain bullet-point lists of brief news items
   - Extract EACH bullet point as a separate nugget
   - Company/product names are often bolded
   - Use relevancy_score: 60-80

Email Content:
${emailContent}

Return your response as JSON in this exact format:
{
  "nuggets": [
    {
      "title": "string (10-60 chars)",
      "description": "string (50-200 chars)",
      "content": "string (optional) - additional context",
      "link": "string (optional) - URL if mentioned",
      "relevancy_score": number (0-100),
      "tags": ["string", "string"] - 2-4 relevant tags
    }
  ]
}

Return ONLY valid JSON, no markdown formatting or code blocks.
```

## Expected Output Quality

For the sample email, we should extract approximately:
- **4 main story nuggets** (Instagram, DeepSeek, Codex, OpenAI audio device)
- **5 "everything else" nuggets** (IQuest Labs, LMArena, Kimi funding, SoftBank, Claude experiment)
- **0 sponsored content nuggets** (Nebius should be excluded)

Total: ~9 nuggets (currently only extracting 5, and 1 is sponsored content)

## Implementation Notes

The improved prompt should be tested with multiple newsletter samples to ensure:
1. Sponsored content is reliably excluded
2. "Everything else" sections are consistently extracted
3. No duplicate nuggets from the same story
4. Relevancy scores reflect content priority appropriately
