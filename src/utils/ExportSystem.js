import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import createCsvWriter from 'csv-writer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ExportSystem {
  constructor(options = {}) {
    this.exportsDir = path.join(__dirname, '../../exports');
    this.archiveDir = path.join(__dirname, '../../archives');
    this.formats = ['json', 'csv', 'html', 'txt'];
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.ensureDir(this.exportsDir);
      await fs.ensureDir(this.archiveDir);
    } catch (error) {
      console.error('Failed to create export directories:', error);
    }
  }

  async exportSession(sessionData, format = 'json', options = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sessionId = sessionData.sessionId || 'unknown';
      const filename = `session_${sessionId}_${timestamp}`;
      
      console.log(`📤 Exporting session in ${format} format...`);
      
      switch (format.toLowerCase()) {
        case 'json':
          return await this.exportAsJSON(sessionData, filename, options);
        
        case 'csv':
          return await this.exportAsCSV(sessionData, filename, options);
        
        case 'html':
          return await this.exportAsHTML(sessionData, filename, options);
        
        case 'txt':
          return await this.exportAsText(sessionData, filename, options);
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  async exportAsJSON(sessionData, filename, options = {}) {
    try {
      const filepath = path.join(this.exportsDir, `${filename}.json`);
      
      const exportData = {
        metadata: {
          exportTimestamp: new Date().toISOString(),
          format: 'json',
          version: '1.0',
          sessionId: sessionData.sessionId
        },
        session: sessionData,
        summary: this.generateSummary(sessionData)
      };
      
      await fs.writeJson(filepath, exportData, { spaces: 2 });
      
      console.log(`✅ JSON export completed: ${filepath}`);
      return {
        filepath,
        filename: `${filename}.json`,
        format: 'json',
        size: (await fs.stat(filepath)).size
      };
    } catch (error) {
      console.error('JSON export failed:', error);
      throw error;
    }
  }

  async exportAsCSV(sessionData, filename, options = {}) {
    try {
      const filepath = path.join(this.exportsDir, `${filename}.csv`);
      
      // Prepare data for CSV export
      const csvData = this.prepareCSVData(sessionData);
      
      const csvWriter = createCsvWriter.createObjectCsvWriter({
        path: filepath,
        header: [
          { id: 'timestamp', title: 'Timestamp' },
          { id: 'type', title: 'Type' },
          { id: 'intent', title: 'Intent' },
          { id: 'originalText', title: 'Original Text' },
          { id: 'success', title: 'Success' },
          { id: 'url', title: 'URL' },
          { id: 'pageTitle', title: 'Page Title' },
          { id: 'error', title: 'Error' },
          { id: 'parameters', title: 'Parameters' }
        ]
      });
      
      await csvWriter.writeRecords(csvData);
      
      console.log(`✅ CSV export completed: ${filepath}`);
      return {
        filepath,
        filename: `${filename}.csv`,
        format: 'csv',
        size: (await fs.stat(filepath)).size
      };
    } catch (error) {
      console.error('CSV export failed:', error);
      throw error;
    }
  }

  async exportAsHTML(sessionData, filename, options = {}) {
    try {
      const filepath = path.join(this.exportsDir, `${filename}.html`);
      
      const htmlContent = this.generateHTMLReport(sessionData);
      
      await fs.writeFile(filepath, htmlContent);
      
      console.log(`✅ HTML export completed: ${filepath}`);
      return {
        filepath,
        filename: `${filename}.html`,
        format: 'html',
        size: (await fs.stat(filepath)).size
      };
    } catch (error) {
      console.error('HTML export failed:', error);
      throw error;
    }
  }

  async exportAsText(sessionData, filename, options = {}) {
    try {
      const filepath = path.join(this.exportsDir, `${filename}.txt`);
      
      const textContent = this.generateTextReport(sessionData);
      
      await fs.writeFile(filepath, textContent);
      
      console.log(`✅ Text export completed: ${filepath}`);
      return {
        filepath,
        filename: `${filename}.txt`,
        format: 'txt',
        size: (await fs.stat(filepath)).size
      };
    } catch (error) {
      console.error('Text export failed:', error);
      throw error;
    }
  }

  prepareCSVData(sessionData) {
    const csvData = [];
    
    // Add session metadata
    csvData.push({
      timestamp: sessionData.startTime,
      type: 'session_start',
      intent: 'session',
      originalText: 'Session started',
      success: true,
      url: sessionData.currentUrl || '',
      pageTitle: sessionData.pageTitle || '',
      error: '',
      parameters: JSON.stringify({ sessionId: sessionData.sessionId })
    });
    
    // Add conversation history
    if (sessionData.conversationHistory) {
      for (const entry of sessionData.conversationHistory) {
        csvData.push({
          timestamp: entry.timestamp,
          type: 'conversation',
          intent: entry.intent,
          originalText: entry.originalText,
          success: entry.success,
          url: entry.result?.url || '',
          pageTitle: entry.result?.title || '',
          error: entry.result?.error || '',
          parameters: JSON.stringify(entry.parameters)
        });
      }
    }
    
    // Add errors
    if (sessionData.errorHistory) {
      for (const error of sessionData.errorHistory) {
        csvData.push({
          timestamp: error.timestamp,
          type: 'error',
          intent: error.intent || '',
          originalText: error.originalText || '',
          success: false,
          url: '',
          pageTitle: '',
          error: error.error,
          parameters: ''
        });
      }
    }
    
    return csvData;
  }

  generateHTMLReport(sessionData) {
    const summary = this.generateSummary(sessionData);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice Agent Session Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .summary { background: #e8f5e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .error { background: #ffe8e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .conversation { background: #f8f8f8; padding: 15px; border-radius: 5px; margin-bottom: 10px; }
        .success { border-left: 4px solid #4CAF50; }
        .failure { border-left: 4px solid #f44336; }
        .metadata { font-size: 0.9em; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Voice Agent Session Report</h1>
        <div class="metadata">
            <p><strong>Session ID:</strong> ${sessionData.sessionId}</p>
            <p><strong>Start Time:</strong> ${sessionData.startTime}</p>
            <p><strong>End Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Duration:</strong> ${summary.duration}</p>
        </div>
    </div>
    
    <div class="summary">
        <h2>Session Summary</h2>
        <ul>
            <li><strong>Total Actions:</strong> ${summary.totalActions}</li>
            <li><strong>Successful Actions:</strong> ${summary.successfulActions}</li>
            <li><strong>Failed Actions:</strong> ${summary.failedActions}</li>
            <li><strong>Success Rate:</strong> ${summary.successRate}%</li>
            <li><strong>Extracted Data Items:</strong> ${summary.extractedDataCount}</li>
            <li><strong>Screenshots Taken:</strong> ${summary.screenshotCount}</li>
        </ul>
    </div>
    
    <h2>Conversation History</h2>
    ${this.generateConversationHTML(sessionData.conversationHistory || [])}
    
    ${sessionData.errorHistory && sessionData.errorHistory.length > 0 ? `
    <h2>Error History</h2>
    ${this.generateErrorHTML(sessionData.errorHistory)}
    ` : ''}
    
    ${sessionData.extractedData && sessionData.extractedData.length > 0 ? `
    <h2>Extracted Data</h2>
    ${this.generateExtractedDataHTML(sessionData.extractedData)}
    ` : ''}
    
    <div class="metadata">
        <p><em>Report generated on ${new Date().toISOString()}</em></p>
    </div>
</body>
</html>`;
  }

  generateConversationHTML(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return '<p>No conversation history available.</p>';
    }
    
    return conversationHistory.map(entry => `
      <div class="conversation ${entry.success ? 'success' : 'failure'}">
        <h3>${entry.intent} - ${entry.success ? 'Success' : 'Failed'}</h3>
        <p><strong>Original Text:</strong> "${entry.originalText}"</p>
        <p><strong>Timestamp:</strong> ${entry.timestamp}</p>
        ${entry.parameters ? `<p><strong>Parameters:</strong> ${JSON.stringify(entry.parameters)}</p>` : ''}
        ${entry.result ? `<p><strong>Result:</strong> ${JSON.stringify(entry.result)}</p>` : ''}
        ${entry.error ? `<p><strong>Error:</strong> ${entry.error}</p>` : ''}
      </div>
    `).join('');
  }

  generateErrorHTML(errorHistory) {
    return errorHistory.map(error => `
      <div class="error">
        <h3>Error: ${error.intent || 'Unknown'}</h3>
        <p><strong>Timestamp:</strong> ${error.timestamp}</p>
        <p><strong>Error:</strong> ${error.error}</p>
        ${error.originalText ? `<p><strong>Original Text:</strong> "${error.originalText}"</p>` : ''}
        ${error.stack ? `<pre>${error.stack}</pre>` : ''}
      </div>
    `).join('');
  }

  generateExtractedDataHTML(extractedData) {
    return extractedData.map((data, index) => `
      <div class="conversation">
        <h3>Data Extraction ${index + 1}</h3>
        <p><strong>Timestamp:</strong> ${data.timestamp}</p>
        <p><strong>Data Type:</strong> ${data.dataType}</p>
        <p><strong>Selector:</strong> ${data.selector || 'N/A'}</p>
        <pre>${JSON.stringify(data.data, null, 2)}</pre>
      </div>
    `).join('');
  }

  generateTextReport(sessionData) {
    const summary = this.generateSummary(sessionData);
    
    let report = `VOICE AGENT SESSION REPORT
============================

Session ID: ${sessionData.sessionId}
Start Time: ${sessionData.startTime}
End Time: ${new Date().toISOString()}
Duration: ${summary.duration}

SUMMARY
--------
Total Actions: ${summary.totalActions}
Successful Actions: ${summary.successfulActions}
Failed Actions: ${summary.failedActions}
Success Rate: ${summary.successRate}%
Extracted Data Items: ${summary.extractedDataCount}
Screenshots Taken: ${summary.screenshotCount}

CONVERSATION HISTORY
-------------------
`;

    if (sessionData.conversationHistory && sessionData.conversationHistory.length > 0) {
      sessionData.conversationHistory.forEach((entry, index) => {
        report += `
${index + 1}. ${entry.intent} - ${entry.success ? 'SUCCESS' : 'FAILED'}
   Original Text: "${entry.originalText}"
   Timestamp: ${entry.timestamp}
   ${entry.parameters ? `Parameters: ${JSON.stringify(entry.parameters)}` : ''}
   ${entry.result ? `Result: ${JSON.stringify(entry.result)}` : ''}
   ${entry.error ? `Error: ${entry.error}` : ''}
`;
      });
    } else {
      report += 'No conversation history available.\n';
    }

    if (sessionData.errorHistory && sessionData.errorHistory.length > 0) {
      report += `
ERROR HISTORY
------------
`;
      sessionData.errorHistory.forEach((error, index) => {
        report += `
${index + 1}. Error: ${error.intent || 'Unknown'}
   Timestamp: ${error.timestamp}
   Error: ${error.error}
   ${error.originalText ? `Original Text: "${error.originalText}"` : ''}
`;
      });
    }

    report += `
Report generated on: ${new Date().toISOString()}
`;

    return report;
  }

  generateSummary(sessionData) {
    const totalActions = sessionData.conversationHistory ? sessionData.conversationHistory.length : 0;
    const successfulActions = sessionData.conversationHistory ? 
      sessionData.conversationHistory.filter(a => a.success).length : 0;
    const failedActions = totalActions - successfulActions;
    const successRate = totalActions > 0 ? Math.round((successfulActions / totalActions) * 100) : 0;
    
    const startTime = new Date(sessionData.startTime);
    const endTime = new Date();
    const durationMs = endTime - startTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    const duration = `${hours}h ${minutes}m ${seconds}s`;

    return {
      totalActions,
      successfulActions,
      failedActions,
      successRate,
      duration,
      extractedDataCount: sessionData.extractedData ? sessionData.extractedData.length : 0,
      screenshotCount: sessionData.screenshots ? sessionData.screenshots.length : 0
    };
  }

  async archiveSession(sessionData, options = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sessionId = sessionData.sessionId || 'unknown';
      const archiveName = `archive_${sessionId}_${timestamp}`;
      const archivePath = path.join(this.archiveDir, archiveName);
      
      console.log(`📦 Creating session archive...`);
      
      // Create archive directory
      await fs.ensureDir(archivePath);
      
      // Export in multiple formats
      const exports = {};
      for (const format of this.formats) {
        try {
          const exportResult = await this.exportSession(sessionData, format, options);
          exports[format] = exportResult;
          
          // Copy export to archive
          const archiveFile = path.join(archivePath, exportResult.filename);
          await fs.copy(exportResult.filepath, archiveFile);
        } catch (error) {
          console.warn(`Failed to export ${format} format:`, error.message);
        }
      }
      
      // Copy screenshots if available
      if (sessionData.screenshots && sessionData.screenshots.length > 0) {
        const screenshotsDir = path.join(archivePath, 'screenshots');
        await fs.ensureDir(screenshotsDir);
        
        for (const screenshot of sessionData.screenshots) {
          if (await fs.pathExists(screenshot.filepath)) {
            const filename = path.basename(screenshot.filepath);
            await fs.copy(screenshot.filepath, path.join(screenshotsDir, filename));
          }
        }
      }
      
      // Create archive manifest
      const manifest = {
        archiveName,
        createdAt: new Date().toISOString(),
        sessionId: sessionData.sessionId,
        exports,
        summary: this.generateSummary(sessionData)
      };
      
      await fs.writeJson(path.join(archivePath, 'manifest.json'), manifest, { spaces: 2 });
      
      console.log(`✅ Session archive created: ${archivePath}`);
      return {
        archivePath,
        archiveName,
        manifest,
        exports
      };
    } catch (error) {
      console.error('Archive creation failed:', error);
      throw error;
    }
  }

  async listExports() {
    try {
      const files = await fs.readdir(this.exportsDir);
      const exports = [];
      
      for (const file of files) {
        const filepath = path.join(this.exportsDir, file);
        const stats = await fs.stat(filepath);
        
        exports.push({
          filename: file,
          filepath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
      
      return exports.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Failed to list exports:', error);
      return [];
    }
  }

  async listArchives() {
    try {
      const dirs = await fs.readdir(this.archiveDir);
      const archives = [];
      
      for (const dir of dirs) {
        const archivePath = path.join(this.archiveDir, dir);
        const stats = await fs.stat(archivePath);
        
        if (stats.isDirectory()) {
          const manifestPath = path.join(archivePath, 'manifest.json');
          let manifest = null;
          
          if (await fs.pathExists(manifestPath)) {
            manifest = await fs.readJson(manifestPath);
          }
          
          archives.push({
            archiveName: dir,
            archivePath,
            created: stats.birthtime,
            modified: stats.mtime,
            manifest
          });
        }
      }
      
      return archives.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Failed to list archives:', error);
      return [];
    }
  }

  async cleanupOldExports(maxAgeHours = 24) {
    try {
      const exports = await this.listExports();
      const archives = await this.listArchives();
      
      let cleanedExports = 0;
      let cleanedArchives = 0;
      
      // Cleanup old exports
      for (const exportFile of exports) {
        const ageInHours = (Date.now() - exportFile.created.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours > maxAgeHours) {
          await fs.unlink(exportFile.filepath);
          cleanedExports++;
          console.log(`🗑️ Cleaned up old export: ${exportFile.filename}`);
        }
      }
      
      // Cleanup old archives
      for (const archive of archives) {
        const ageInHours = (Date.now() - archive.created.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours > maxAgeHours) {
          await fs.remove(archive.archivePath);
          cleanedArchives++;
          console.log(`🗑️ Cleaned up old archive: ${archive.archiveName}`);
        }
      }
      
      console.log(`✅ Cleanup completed: ${cleanedExports} exports, ${cleanedArchives} archives removed`);
      
      return {
        cleanedExports,
        cleanedArchives
      };
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }
}

export default ExportSystem;
