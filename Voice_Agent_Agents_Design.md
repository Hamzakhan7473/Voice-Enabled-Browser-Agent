# Agent Designs for Voice Browser Automation

## 3. Agent Designs

### 3.1 Simple Reflex Agent

**Design:** Direct condition-action mappings based on immediate percepts

**Condition-Action Rules:**

| Condition | Action |
|-----------|--------|
| Speech contains "search for [X]" | Navigate to google.com → Click search box → Type "[X]" |
| Speech contains "go to [URL]" | Navigate to "[URL]" |
| Page shows "login" button | Click "login" button |
| Page shows search results | Click first result link |
| Speech contains "click [element]" | Click element by text content |
| CAPTCHA detected | Log warning and continue |
| Speech contains "fill form" | Find first form → Type in first input field |

**Percept Attributes Used:**
- `speech_text`: Raw transcript from STT
- `page_title`: Current page title
- `visible_text`: Text content of clickable elements
- `url`: Current browser URL
- `captcha_present`: Boolean flag for CAPTCHA detection

**Failure Case:**
**Scenario:** User says "go back and click the second result"
**Why it fails:** Agent sees only current page state, lacks memory of previous actions and navigation history. Cannot identify "second result" without knowing what results were previously visible.

**Limitation:** Cannot maintain context or handle sequential commands requiring knowledge of past actions.

### 3.2 Model-Based Reflex Agent

**Internal State Representation:**

| Attribute | Type | Possible Values | Initial Value | Update Conditions |
|-----------|------|----------------|---------------|------------------|
| `navigation_history` | Array | List of URLs visited | `[]` | Updated on each navigation action |
| `search_results` | Array | List of result titles/URLs | `[]` | Updated when search page is detected |
| `current_task` | String | Task description or "none" | `"none"` | Updated when new voice command received |
| `form_fields_filled` | Array | List of form field names | `[]` | Updated after each successful form input |
| `page_load_status` | String | "loading", "loaded", "error" | `"unknown"` | Updated based on page response |
| `previous_screenshot` | Image | Base64 encoded image | `null` | Updated on each screenshot capture |

**State Update Trace:**

```
Before → New Percepts → After → Next Action
Before: navigation_history = ["google.com"]; current_task = "search for pizza"; search_results = []
New Percepts: Page loaded with search results for "pizza"
After: update page_load_status = "loaded"; update search_results = ["Pizza Hut", "Domino's", "Local Pizza"]; identify clickable elements
Next Action: Click on "Pizza Hut" (first result) based on predetermined "first result" rule
```

**How This Helps Avoid Simple Reflex Failure:**
- **Memory:** Maintains `search_results` array to reference "second result"
- **Context:** Uses `navigation_history` to understand "go back" means previous URL
- **Task Tracking:** `current_task` maintains user intent across multiple steps

**Example Update Sequence:**
```
Step 1: User: "search for vegan restaurants"
After: current_task = "search for vegan restaurants"; navigation_history = ["google.com"]

Step 2: User: "go back and try again"  
After: navigation_history = ["google.com"] (back to previous); current_task maintained
Action: Navigate back to previous page with same search for "vegan restaurants"
```

### 3.3 Goal-Based Agent

**Goals Specification:**
1. **Primary Goal:** Execute user voice command with maximum accuracy
2. **Subgoals:** 
   - Understand user intent from speech
   - Navigate efficiently to target content
   - Complete requested action successfully
   - Maintain user satisfaction

**Decision-Making Process:**

**Scenario:** User says "find me a cheap pizza place nearby and book a table"

**Percept:** Speech text = "find me a cheap pizza place nearby and book a table"
**Goals:** Find restaurant + comparative analysis ("cheap") + location awareness ("nearby") + reservation ("book table")

**Reasoning Process:**
1. **Goal Decomposition:** Split into subgoals - search → filter → select → book
2. **Action Selection:** Choose Google Maps over general search for location + pricing data
3. **Resource Planning:** Prioritize efficiency (distance + price) over speed
4. **Progress Monitoring:** Check each subgoal completion before proceeding

**Action Selection Rationale:**
- **Why Google Maps:** Better geolocation and pricing comparison than general web search
- **Why "cheap filter first":** User explicitly prioritizes cost over other factors
- **Why location-aware:** "nearby" implies geographic relevance
- **Why booking integration:** Multi-step process requiring structured goal tracking

**Goal Achievement Check:**
- Subgoal 1: ✅ Found restaurant listing
- Subgoal 2: ✅ Applied price filters  
- Subgoal 3: ✅ Selected from nearby options
- Subgoal 4: ❌ Booking interface found but reservation incomplete

**Adaptive Response:** Notify user booking step requires manual intervention due to complex form validation.

### 3.4 Utility-Based Agent

**Utility Function Definition:**

**Mathematical Utility Function:**
```
U(action) = w₁×Speed + w₂×Accuracy + w₃×UserSatisfaction - w₄×Risk - w₅×Cost

Where:
- Speed = 1/time_to_complete_action (0 to 1)
- Accuracy = percentage_of_successful_actions (0 to 1) 
- UserSatisfaction = intent_matching_score (0 to 1)
- Risk = probability_of_failure × severity (0 to 1)
- Cost = computational_resources_used (0 to 1)

Weights: w₁=0.3, w₂=0.3, w₃=0.2, w₄=0.1, w₅=0.1
```

**Trading Off Competing Objectives:**

**Scenario:** User says "buy this product now" on e-commerce site

**Options Analysis:**
1. **Immediate Click Purchase:** 
   - Speed = 0.9, Accuracy = 0.8, UserSatisfaction = 0.6, Risk = 0.8, Cost = 0.2
   - Utility = 0.3×0.9 + 0.3×0.8 + 0.2×0.6 - 0.1×0.8 - 0.1×0.2 = **0.59**

2. **Show Cart Review First:**
   - Speed = 0.6, Accuracy = 0.95, UserSatisfaction = 0.9, Risk = 0.2, Cost = 0.4
   - Utility = 0.3×0.6 + 0.3×0.95 + 0.2×0.9 - 0.1×0.2 - 0.1×0.4 = **0.69**

**Decision:** Choose Option 2 (show cart review) due to higher overall utility despite slower speed.

**Comparison with Goal-Based Agent:**
- **Goal-Based Agent Decision:** Immediate action toward "buy product" goal
- **Utility-Based Agent Decision:** Weighted optimization considering speed vs. safety
- **Key Difference:** Utility agent avoids destructive actions by factoring in risk weights, while goal-based agent prioritizes goal achievement over potential negative consequences.
