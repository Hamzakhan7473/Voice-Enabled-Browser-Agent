import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContextManager {
  constructor(options = {}) {
    this.sessionId = options.sessionId || this.generateSessionId();
    this.contextData = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      currentUrl: null,
      pageTitle: null,
      pageElements: [],
      previousIntents: [],
      extractedData: [],
      screenshots: [],
      conversationHistory: [],
      userPreferences: {},
      errorHistory: [],
      contextWindow: 10 // Keep last 10 interactions
    };
    
    this.contextDir = path.join(__dirname, '../../context');
    this.ensureContextDir();
  }

  async ensureContextDir() {
    try {
      await fs.ensureDir(this.contextDir);
    } catch (error) {
      console.error('Failed to create context directory:', error);
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async updateContext(intent, result) {
    try {
      // Update basic context
      this.contextData.currentUrl = result.url || this.contextData.currentUrl;
      this.contextData.pageTitle = result.title || this.contextData.pageTitle;
      
      // Add to conversation history
      const conversationEntry = {
        timestamp: new Date().toISOString(),
        intent: intent.intent,
        originalText: intent.originalText,
        parameters: intent.parameters,
        result: result,
        success: result.success !== false
      };
      
      this.contextData.conversationHistory.push(conversationEntry);
      
      // Add to previous intents (for reference)
      this.contextData.previousIntents.push({
        intent: intent.intent,
        originalText: intent.originalText,
        timestamp: conversationEntry.timestamp
      });
      
      // Update extracted data if applicable
      if (intent.intent === 'extract' && result.data) {
        this.contextData.extractedData.push({
          timestamp: conversationEntry.timestamp,
          data: result.data,
          dataType: intent.parameters.dataType || 'text',
          selector: intent.parameters.selector
        });
      }
      
      // Update screenshots if applicable
      if (intent.intent === 'screenshot' && result.filepath) {
        this.contextData.screenshots.push({
          timestamp: conversationEntry.timestamp,
          filepath: result.filepath,
          filename: result.filename,
          selector: intent.parameters.selector
        });
      }
      
      // Maintain context window
      this.maintainContextWindow();
      
      // Save context to file
      await this.saveContext();
      
      console.log(`📝 Context updated for session: ${this.sessionId}`);
    } catch (error) {
      console.error('Failed to update context:', error);
    }
  }

  async updatePageContext(pageInfo) {
    try {
      this.contextData.currentUrl = pageInfo.url;
      this.contextData.pageTitle = pageInfo.title;
      this.contextData.pageElements = pageInfo.elements || [];
      
      await this.saveContext();
    } catch (error) {
      console.error('Failed to update page context:', error);
    }
  }

  async addError(error, intent = null) {
    try {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: error.message || error,
        intent: intent ? intent.intent : null,
        originalText: intent ? intent.originalText : null,
        stack: error.stack
      };
      
      this.contextData.errorHistory.push(errorEntry);
      
      // Maintain context window
      this.maintainContextWindow();
      
      await this.saveContext();
    } catch (saveError) {
      console.error('Failed to save error to context:', saveError);
    }
  }

  maintainContextWindow() {
    // Keep only the last N interactions
    const maxInteractions = this.contextData.contextWindow;
    
    if (this.contextData.conversationHistory.length > maxInteractions) {
      this.contextData.conversationHistory = this.contextData.conversationHistory.slice(-maxInteractions);
    }
    
    if (this.contextData.previousIntents.length > maxInteractions) {
      this.contextData.previousIntents = this.contextData.previousIntents.slice(-maxInteractions);
    }
    
    if (this.contextData.errorHistory.length > maxInteractions) {
      this.contextData.errorHistory = this.contextData.errorHistory.slice(-maxInteractions);
    }
  }

  getContextForIntentParsing() {
    return {
      currentUrl: this.contextData.currentUrl,
      pageTitle: this.contextData.pageTitle,
      pageElements: this.contextData.pageElements.slice(0, 20), // Limit for performance
      previousIntents: this.contextData.previousIntents.slice(-5), // Last 5 intents
      extractedData: this.contextData.extractedData.slice(-3), // Last 3 extractions
      recentErrors: this.contextData.errorHistory.slice(-3) // Last 3 errors
    };
  }

  getContextForBrowserAction() {
    return {
      currentUrl: this.contextData.currentUrl,
      pageTitle: this.contextData.pageTitle,
      pageElements: this.contextData.pageElements,
      recentActions: this.contextData.conversationHistory.slice(-5),
      extractedData: this.contextData.extractedData,
      screenshots: this.contextData.screenshots
    };
  }

  async resolveReference(reference, intentType) {
    try {
      // Handle references like "the second result", "that button", "the previous page"
      const lowerRef = reference.toLowerCase();
      
      if (lowerRef.includes('second') || lowerRef.includes('2nd')) {
        return this.resolveIndexReference(1, intentType);
      } else if (lowerRef.includes('third') || lowerRef.includes('3rd')) {
        return this.resolveIndexReference(2, intentType);
      } else if (lowerRef.includes('first') || lowerRef.includes('1st')) {
        return this.resolveIndexReference(0, intentType);
      } else if (lowerRef.includes('last')) {
        return this.resolveLastReference(intentType);
      } else if (lowerRef.includes('previous') || lowerRef.includes('before')) {
        return this.resolvePreviousReference(intentType);
      } else if (lowerRef.includes('that') || lowerRef.includes('this')) {
        return this.resolveCurrentReference(intentType);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to resolve reference:', error);
      return null;
    }
  }

  resolveIndexReference(index, intentType) {
    const recentActions = this.contextData.conversationHistory.slice(-10);
    
    switch (intentType) {
      case 'click':
        // Find recent search results or extracted links
        const clickableElements = this.contextData.pageElements.filter(el => 
          el.tag === 'a' || el.tag === 'button' || el.type === 'submit'
        );
        return clickableElements[index] ? `#${clickableElements[index].id}` : null;
      
      case 'extract':
        // Find recent extraction results
        const recentExtractions = this.contextData.extractedData.slice(-5);
        return recentExtractions[index] ? recentExtractions[index].selector : null;
      
      default:
        return null;
    }
  }

  resolveLastReference(intentType) {
    const recentActions = this.contextData.conversationHistory.slice(-5);
    
    for (let i = recentActions.length - 1; i >= 0; i--) {
      const action = recentActions[i];
      if (action.intent === intentType) {
        return action.parameters.selector || action.result.selector;
      }
    }
    
    return null;
  }

  resolvePreviousReference(intentType) {
    const recentActions = this.contextData.conversationHistory.slice(-10);
    
    for (let i = recentActions.length - 2; i >= 0; i--) {
      const action = recentActions[i];
      if (action.intent === intentType) {
        return action.parameters.selector || action.result.selector;
      }
    }
    
    return null;
  }

  resolveCurrentReference(intentType) {
    // Return the most recent element of the specified type
    const recentActions = this.contextData.conversationHistory.slice(-3);
    
    for (let i = recentActions.length - 1; i >= 0; i--) {
      const action = recentActions[i];
      if (action.intent === intentType) {
        return action.parameters.selector || action.result.selector;
      }
    }
    
    return null;
  }

  async enhanceIntentWithContext(intent) {
    try {
      const enhancedIntent = { ...intent };
      
      // Resolve references in parameters
      for (const [key, value] of Object.entries(enhancedIntent.parameters)) {
        if (typeof value === 'string' && this.containsReference(value)) {
          const resolvedValue = await this.resolveReference(value, enhancedIntent.intent);
          if (resolvedValue) {
            enhancedIntent.parameters[key] = resolvedValue;
            enhancedIntent.contextResolved = true;
          }
        }
      }
      
      // Add context metadata
      enhancedIntent.contextMetadata = {
        sessionId: this.sessionId,
        currentUrl: this.contextData.currentUrl,
        pageTitle: this.contextData.pageTitle,
        previousActions: this.contextData.conversationHistory.slice(-3),
        timestamp: new Date().toISOString()
      };
      
      return enhancedIntent;
    } catch (error) {
      console.error('Failed to enhance intent with context:', error);
      return intent;
    }
  }

  containsReference(text) {
    const referencePatterns = [
      'second', 'third', 'first', 'last', 'previous', 'before',
      'that', 'this', 'the above', 'the below', 'the next'
    ];
    
    const lowerText = text.toLowerCase();
    return referencePatterns.some(pattern => lowerText.includes(pattern));
  }

  async saveContext() {
    try {
      const contextFile = path.join(this.contextDir, `${this.sessionId}.json`);
      await fs.writeJson(contextFile, this.contextData, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save context:', error);
    }
  }

  async loadContext(sessionId = null) {
    try {
      const targetSessionId = sessionId || this.sessionId;
      const contextFile = path.join(this.contextDir, `${targetSessionId}.json`);
      
      if (await fs.pathExists(contextFile)) {
        this.contextData = await fs.readJson(contextFile);
        this.sessionId = targetSessionId;
        console.log(`📂 Context loaded for session: ${targetSessionId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to load context:', error);
      return false;
    }
  }

  async exportContext(format = 'json') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `context_${this.sessionId}_${timestamp}`;
      
      switch (format.toLowerCase()) {
        case 'json':
          const jsonFile = path.join(this.contextDir, `${filename}.json`);
          await fs.writeJson(jsonFile, this.contextData, { spaces: 2 });
          return jsonFile;
        
        case 'csv':
          const csvFile = path.join(this.contextDir, `${filename}.csv`);
          const csvData = this.convertToCSV();
          await fs.writeFile(csvFile, csvData);
          return csvFile;
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export context:', error);
      throw error;
    }
  }

  convertToCSV() {
    const rows = [];
    
    // Add conversation history
    for (const entry of this.contextData.conversationHistory) {
      rows.push({
        timestamp: entry.timestamp,
        type: 'conversation',
        intent: entry.intent,
        originalText: entry.originalText,
        success: entry.success
      });
    }
    
    // Add errors
    for (const error of this.contextData.errorHistory) {
      rows.push({
        timestamp: error.timestamp,
        type: 'error',
        intent: error.intent,
        originalText: error.originalText,
        error: error.error
      });
    }
    
    if (rows.length === 0) {
      return 'timestamp,type,intent,originalText,success,error\n';
    }
    
    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of rows) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value || '';
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  getContextSummary() {
    return {
      sessionId: this.sessionId,
      startTime: this.contextData.startTime,
      currentUrl: this.contextData.currentUrl,
      pageTitle: this.contextData.pageTitle,
      totalInteractions: this.contextData.conversationHistory.length,
      successfulActions: this.contextData.conversationHistory.filter(a => a.success).length,
      failedActions: this.contextData.conversationHistory.filter(a => !a.success).length,
      extractedDataCount: this.contextData.extractedData.length,
      screenshotCount: this.contextData.screenshots.length,
      errorCount: this.contextData.errorHistory.length,
      recentIntents: this.contextData.previousIntents.slice(-5)
    };
  }

  clearContext() {
    this.contextData = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      currentUrl: null,
      pageTitle: null,
      pageElements: [],
      previousIntents: [],
      extractedData: [],
      screenshots: [],
      conversationHistory: [],
      userPreferences: {},
      errorHistory: [],
      contextWindow: 10
    };
  }

  async cleanupOldContexts(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.contextDir);
      const contextFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of contextFiles) {
        const filePath = path.join(this.contextDir, file);
        const stats = await fs.stat(filePath);
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours > maxAgeHours) {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up old context file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old contexts:', error);
    }
  }
}

export default ContextManager;
