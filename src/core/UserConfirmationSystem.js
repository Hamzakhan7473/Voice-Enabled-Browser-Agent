import { EventEmitter } from 'events';

class UserConfirmationSystem extends EventEmitter {
  constructor() {
    super();
    this.pendingConfirmations = new Map();
    this.confirmationHistory = [];
    this.sensitiveActions = [
      'purchase', 'buy', 'checkout', 'payment', 'order',
      'login', 'signin', 'authenticate', 'password',
      'delete', 'remove', 'unsubscribe', 'cancel',
      'submit', 'send', 'post', 'publish',
      'download', 'upload', 'install', 'upgrade'
    ];
  }

  requiresConfirmation(intent, context = {}) {
    // Check if action is inherently sensitive
    const isSensitiveAction = this.sensitiveActions.some(action => 
      intent.intent.toLowerCase().includes(action) ||
      intent.originalText.toLowerCase().includes(action)
    );

    // Check if action involves financial transactions
    const isFinancial = this.isFinancialAction(intent, context);

    // Check if action involves personal data
    const isPersonalData = this.isPersonalDataAction(intent, context);

    // Check if action modifies data
    const isDataModification = this.isDataModificationAction(intent, context);

    // Check risk level
    const isHighRisk = intent.riskLevel === 'high';

    return isSensitiveAction || isFinancial || isPersonalData || isDataModification || isHighRisk;
  }

  isFinancialAction(intent, context) {
    const financialKeywords = [
      'price', 'cost', 'buy', 'purchase', 'order', 'checkout',
      'payment', 'credit card', 'billing', 'subscription',
      'cart', 'shopping', 'ecommerce', 'store'
    ];

    const text = `${intent.originalText} ${context.currentUrl || ''}`.toLowerCase();
    return financialKeywords.some(keyword => text.includes(keyword));
  }

  isPersonalDataAction(intent, context) {
    const personalKeywords = [
      'email', 'password', 'login', 'signin', 'register',
      'profile', 'account', 'personal', 'private',
      'address', 'phone', 'name', 'ssn', 'social security'
    ];

    const text = `${intent.originalText} ${context.currentUrl || ''}`.toLowerCase();
    return personalKeywords.some(keyword => text.includes(keyword));
  }

  isDataModificationAction(intent, context) {
    const modificationKeywords = [
      'delete', 'remove', 'update', 'edit', 'modify',
      'submit', 'post', 'publish', 'upload', 'send',
      'unsubscribe', 'cancel', 'disable', 'enable'
    ];

    const text = intent.originalText.toLowerCase();
    return modificationKeywords.some(keyword => text.includes(keyword));
  }

  async requestConfirmation(intent, context, taskId = null) {
    const confirmationId = `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const confirmation = {
      id: confirmationId,
      taskId,
      intent,
      context,
      timestamp: Date.now(),
      status: 'pending',
      message: this.generateConfirmationMessage(intent, context),
      risks: this.identifyRisks(intent, context),
      alternatives: this.suggestAlternatives(intent, context)
    };

    this.pendingConfirmations.set(confirmationId, confirmation);

    console.log(`🤔 Confirmation required: ${confirmation.message}`);
    this.emit('confirmation-requested', confirmation);

    return confirmation;
  }

  generateConfirmationMessage(intent, context) {
    const action = intent.intent;
    const url = context.currentUrl || 'current page';
    
    switch (action) {
      case 'navigate':
        return `I'm about to navigate to ${intent.parameters?.url || 'a new page'}. This might take you away from your current work. Should I proceed?`;
      
      case 'click':
        return `I'm about to click on "${intent.parameters?.selector || 'an element'}" on ${url}. This might trigger an action or navigation. Should I proceed?`;
      
      case 'fill':
        return `I'm about to fill "${intent.parameters?.selector || 'a form field'}" with "${intent.parameters?.value || 'data'}" on ${url}. Should I proceed?`;
      
      case 'search':
        return `I'm about to search for "${intent.parameters?.query || 'something'}" on ${url}. Should I proceed?`;
      
      case 'extract':
        return `I'm about to extract data from ${url}. This might include personal or sensitive information. Should I proceed?`;
      
      default:
        return `I'm about to perform a "${action}" action on ${url}. This might have unintended consequences. Should I proceed?`;
    }
  }

  identifyRisks(intent, context) {
    const risks = [];

    if (this.isFinancialAction(intent, context)) {
      risks.push('Financial transaction - may involve money or payment');
    }

    if (this.isPersonalDataAction(intent, context)) {
      risks.push('Personal data - may access or modify personal information');
    }

    if (this.isDataModificationAction(intent, context)) {
      risks.push('Data modification - may change or delete information');
    }

    if (intent.riskLevel === 'high') {
      risks.push('High risk action - may have significant consequences');
    }

    if (context.currentUrl?.includes('bank') || context.currentUrl?.includes('financial')) {
      risks.push('Financial website - extra caution required');
    }

    return risks;
  }

  suggestAlternatives(intent, context) {
    const alternatives = [];

    switch (intent.intent) {
      case 'navigate':
        alternatives.push('Stay on current page and explore existing content');
        alternatives.push('Ask for clarification about the destination');
        break;
      
      case 'click':
        alternatives.push('Hover over the element first to see what it does');
        alternatives.push('Scroll to see more context before clicking');
        break;
      
      case 'fill':
        alternatives.push('Review the form fields first');
        alternatives.push('Ask for clarification about what to fill');
        break;
      
      case 'extract':
        alternatives.push('Take a screenshot first to review the content');
        alternatives.push('Ask for specific data to extract');
        break;
    }

    return alternatives;
  }

  async waitForConfirmation(confirmationId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const confirmation = this.pendingConfirmations.get(confirmationId);
      if (!confirmation) {
        reject(new Error('Confirmation not found'));
        return;
      }

      const timeoutId = setTimeout(() => {
        this.pendingConfirmations.delete(confirmationId);
        reject(new Error('Confirmation timeout'));
      }, timeout);

      const onConfirmation = (result) => {
        if (result.id === confirmationId) {
          clearTimeout(timeoutId);
          this.pendingConfirmations.delete(confirmationId);
          this.confirmationHistory.push({
            ...confirmation,
            status: result.confirmed ? 'confirmed' : 'rejected',
            userResponse: result.userResponse,
            resolvedAt: Date.now()
          });
          
          this.removeListener('confirmation-provided', onConfirmation);
          resolve(result);
        }
      };

      this.on('confirmation-provided', onConfirmation);
    });
  }

  provideConfirmation(confirmationId, confirmed, userResponse = null) {
    const confirmation = this.pendingConfirmations.get(confirmationId);
    if (!confirmation) {
      throw new Error('Confirmation not found');
    }

    const result = {
      id: confirmationId,
      confirmed,
      userResponse,
      timestamp: Date.now()
    };

    console.log(`👤 User ${confirmed ? 'confirmed' : 'rejected'} action: ${confirmation.message}`);
    this.emit('confirmation-provided', result);

    return result;
  }

  getPendingConfirmations() {
    return Array.from(this.pendingConfirmations.values());
  }

  getConfirmationHistory() {
    return this.confirmationHistory;
  }

  getConfirmationStats() {
    const total = this.confirmationHistory.length;
    const confirmed = this.confirmationHistory.filter(c => c.status === 'confirmed').length;
    const rejected = this.confirmationHistory.filter(c => c.status === 'rejected').length;

    return {
      total,
      confirmed,
      rejected,
      confirmationRate: total > 0 ? Math.round((confirmed / total) * 100) : 0
    };
  }
}

export default UserConfirmationSystem;
