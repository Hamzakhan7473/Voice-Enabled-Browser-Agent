import { EventEmitter } from 'events';

class TaskTracker extends EventEmitter {
  constructor() {
    super();
    this.activeTasks = new Map();
    this.taskHistory = [];
    this.currentTaskId = null;
  }

  startTask(taskId, taskInfo) {
    const task = {
      id: taskId,
      ...taskInfo,
      status: 'running',
      startTime: Date.now(),
      currentStep: 0,
      totalSteps: taskInfo.steps?.length || 1,
      progress: 0,
      logs: [],
      screenshots: [],
      errors: []
    };

    this.activeTasks.set(taskId, task);
    this.currentTaskId = taskId;
    
    console.log(`🎯 Task started: ${task.description || taskId}`);
    this.emit('task-started', task);
    
    return task;
  }

  updateTaskProgress(taskId, stepNumber, stepInfo) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.currentStep = stepNumber;
    task.progress = Math.round((stepNumber / task.totalSteps) * 100);
    
    const step = {
      stepNumber,
      ...stepInfo,
      timestamp: Date.now(),
      status: 'running'
    };

    task.logs.push(step);
    
    console.log(`📊 Task ${taskId} - Step ${stepNumber}/${task.totalSteps}: ${stepInfo.description || 'Executing step'}`);
    this.emit('step-started', { taskId, step });
    
    return step;
  }

  completeStep(taskId, stepNumber, result) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const step = task.logs.find(log => log.stepNumber === stepNumber);
    if (step) {
      step.status = 'completed';
      step.result = result;
      step.completedAt = Date.now();
      step.duration = step.completedAt - step.timestamp;
    }

    console.log(`✅ Task ${taskId} - Step ${stepNumber} completed`);
    this.emit('step-completed', { taskId, stepNumber, result });
    
    return step;
  }

  failStep(taskId, stepNumber, error) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const step = task.logs.find(log => log.stepNumber === stepNumber);
    if (step) {
      step.status = 'failed';
      step.error = error;
      step.failedAt = Date.now();
      step.duration = step.failedAt - step.timestamp;
    }

    task.errors.push({
      stepNumber,
      error: error.message || error,
      timestamp: Date.now()
    });

    console.log(`❌ Task ${taskId} - Step ${stepNumber} failed: ${error.message || error}`);
    this.emit('step-failed', { taskId, stepNumber, error });
    
    return step;
  }

  addScreenshot(taskId, screenshotData) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const screenshot = {
      timestamp: Date.now(),
      stepNumber: task.currentStep,
      ...screenshotData
    };

    task.screenshots.push(screenshot);
    this.emit('screenshot-added', { taskId, screenshot });
    
    return screenshot;
  }

  requestConfirmation(taskId, stepNumber, confirmationInfo) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const confirmation = {
      taskId,
      stepNumber,
      ...confirmationInfo,
      timestamp: Date.now(),
      status: 'pending'
    };

    console.log(`🤔 Confirmation required for Task ${taskId} - Step ${stepNumber}`);
    this.emit('confirmation-required', confirmation);
    
    return confirmation;
  }

  provideConfirmation(taskId, stepNumber, confirmed, userResponse = null) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const confirmation = {
      taskId,
      stepNumber,
      confirmed,
      userResponse,
      timestamp: Date.now()
    };

    console.log(`👤 User ${confirmed ? 'confirmed' : 'rejected'} Task ${taskId} - Step ${stepNumber}`);
    this.emit('confirmation-provided', confirmation);
    
    return confirmation;
  }

  askClarification(taskId, stepNumber, question) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const clarification = {
      taskId,
      stepNumber,
      question,
      timestamp: Date.now(),
      status: 'waiting'
    };

    console.log(`❓ Clarification needed for Task ${taskId} - Step ${stepNumber}: ${question}`);
    this.emit('clarification-needed', clarification);
    
    return clarification;
  }

  provideClarification(taskId, stepNumber, answer) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    const clarification = {
      taskId,
      stepNumber,
      answer,
      timestamp: Date.now(),
      status: 'answered'
    };

    console.log(`💡 Clarification provided for Task ${taskId} - Step ${stepNumber}`);
    this.emit('clarification-provided', clarification);
    
    return clarification;
  }

  completeTask(taskId, result) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;
    task.result = result;
    task.progress = 100;

    this.activeTasks.delete(taskId);
    this.taskHistory.push(task);
    
    if (this.currentTaskId === taskId) {
      this.currentTaskId = null;
    }

    console.log(`🎉 Task completed: ${task.description || taskId} (${task.duration}ms)`);
    this.emit('task-completed', task);
    
    return task;
  }

  failTask(taskId, error) {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;
    task.error = error;

    this.activeTasks.delete(taskId);
    this.taskHistory.push(task);
    
    if (this.currentTaskId === taskId) {
      this.currentTaskId = null;
    }

    console.log(`💥 Task failed: ${task.description || taskId} - ${error.message || error}`);
    this.emit('task-failed', task);
    
    return task;
  }

  getActiveTasks() {
    return Array.from(this.activeTasks.values());
  }

  getCurrentTask() {
    return this.activeTasks.get(this.currentTaskId);
  }

  getTaskHistory() {
    return this.taskHistory;
  }

  getTaskStats() {
    const total = this.taskHistory.length;
    const completed = this.taskHistory.filter(t => t.status === 'completed').length;
    const failed = this.taskHistory.filter(t => t.status === 'failed').length;
    const active = this.activeTasks.size;

    return {
      total,
      completed,
      failed,
      active,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  generateTaskReport(taskId) {
    const task = this.taskHistory.find(t => t.id === taskId) || this.activeTasks.get(taskId);
    if (!task) return null;

    return {
      id: task.id,
      description: task.description,
      status: task.status,
      duration: task.duration,
      progress: task.progress,
      steps: task.logs,
      screenshots: task.screenshots,
      errors: task.errors,
      startTime: task.startTime,
      endTime: task.endTime,
      result: task.result
    };
  }
}

export default TaskTracker;
