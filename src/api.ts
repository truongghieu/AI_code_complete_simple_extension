import axios, { AxiosResponse } from 'axios';
import * as vscode from 'vscode';

export interface CompletionRequest {
  input: string;
  language: string;
  maxTokens: number;
  stream?: boolean;
}

export interface CompletionResponse {
  completion: string;
}

export interface ModelTag {
  name: string;
  displayName?: string;
  description?: string;
}

export class ClaudeApiClient {
  private baseUrl: string;
  private model: string = 'databricks-claude-sonnet-4'; // Default model
  private availableModels: ModelTag[] = [];

  constructor(baseUrl: string, model?: string) {
    this.baseUrl = baseUrl;
    if (model) {
      this.model = model;
    }
  }
  
  /**
   * Set the model to use for API requests
   * @param model The model name
   */
  setModel(model: string): void {
    this.model = model;
  }
  
  /**
   * Get the current model being used
   * @returns The current model name
   */
  getModel(): string {
    return this.model;
  }
  
  /**
   * Fetch available models from the API
   * @returns Promise with array of available models
   */
  async fetchAvailableModels(): Promise<ModelTag[]> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseUrl}/api/tags`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      console.log('Tags API response:', response.data);
      
      // Handle different response formats
      let modelsList: any[] = [];
      
      if (Array.isArray(response.data)) {
        // Direct array of models
        modelsList = response.data;
      } else if (response.data && Array.isArray(response.data.models)) {
        // Object with models array
        modelsList = response.data.models;
      } else if (response.data && typeof response.data === 'object') {
        // Object with model properties
        modelsList = Object.values(response.data);
      } else {
        console.warn('Unexpected tags API response format:', response.data);
        return [];
      }
      
      this.availableModels = modelsList.map((model: any) => {
        // Handle different model object structures
        if (typeof model === 'string') {
          return {
            name: model,
            displayName: model,
            description: ''
          };
        }
        
        // Handle model object with name/model property
        const modelName = model.name || model.model || '';
        const displayName = model.display_name || model.displayName || modelName;
        const description = model.description || '';
        
        return {
          name: modelName,
          displayName: displayName,
          description: description
        };
      }).filter(model => model.name); // Filter out any empty model names
      
      return this.availableModels;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Tags API Axios error:', error.message);
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
      } else {
        console.error('Tags API unknown error:', error);
      }
      return [];
    }
  }
  
  /**
   * Get cached available models
   * @returns Array of available models
   */
  getAvailableModels(): ModelTag[] {
    return this.availableModels;
  }

  async agentRequest(request: CompletionRequest): Promise<string> {
    try {
      // Format the input with language if provided
      const content = request.language ? 
        `${request.language} ${request.input}` : 
        request.input;

      // Use Ollama-compatible chat endpoint
      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          messages: [
            {
              role: 'user',
              content: content
            }
          ],
          model: this.model,
          stream: true // Always request streaming since the server always responds with streaming
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 50000,
          responseType: 'text' // Important for handling streaming responses
        }
      );

      console.log('API response received');
      
      // Handle streaming response
      if (typeof response.data === 'string') {
        // Split the response by lines and process each line
        const lines = response.data.split('\n').filter(line => line.trim() !== '');
        let fullContent = '';
        
        for (const line of lines) {
          try {
            // Each line should be a JSON object
            const data = JSON.parse(line);
            
            // Handle different streaming formats
            if (data.message?.content) {
              // Ollama format
              fullContent += data.message.content;
            } else if (data.choices?.[0]?.delta?.content) {
              // OpenAI streaming format
              fullContent += data.choices[0].delta.content;
            } else if (data.choices?.[0]?.message?.content) {
              // OpenAI non-streaming format in streaming response
              fullContent += data.choices[0].message.content;
            }
          } catch (e) {
            console.warn('Error parsing streaming response line:', line, e);
          }
        }
        
        return fullContent.trim();
      }
      
      // Fallback for non-streaming responses
      // Handle Ollama-compatible response format
      if (response.data?.message?.content) {
        return response.data.message.content.trim();
      }
      
      // Fallback for OpenAI-compatible format
      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }

      console.warn('Unexpected API response format:', response.data);
      return '';
    } catch (error) {
      // Check if error is an Axios error to handle it properly
      if (axios.isAxiosError(error)) {
        console.error('API Axios error:', error.message);
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
      } else {
        console.error('API unknown error:', error);
      }
      return 'Error: Failed to communicate with the API. Check the console for details.';
    }
  }
  
  // Alternative method using OpenAI-compatible endpoint
  async chatCompletions(request: CompletionRequest): Promise<string> {
    try {
      // Format the input with language if provided
      const content = request.language ? 
        `${request.language} ${request.input}` : 
        request.input;

      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/v1/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: content
            }
          ],
          max_tokens: request.maxTokens,
          stream: true // Always request streaming since the server always responds with streaming
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 50000,
          responseType: 'text' // Important for handling streaming responses
        }
      );

      console.log('OpenAI-compatible API response received');
      
      // Handle streaming response
      if (typeof response.data === 'string') {
        // Split the response by lines and process each line
        const lines = response.data.split('\n').filter(line => line.trim() !== '');
        let fullContent = '';
        
        for (const line of lines) {
          try {
            // Skip "data: " prefix if present (common in SSE)
            const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
            if (jsonStr.trim() === '[DONE]') continue;
            
            // Each line should be a JSON object
            const data = JSON.parse(jsonStr);
            
            // Handle different streaming formats
            if (data.choices?.[0]?.delta?.content) {
              // OpenAI streaming format
              fullContent += data.choices[0].delta.content;
            } else if (data.choices?.[0]?.message?.content) {
              // OpenAI non-streaming format in streaming response
              fullContent += data.choices[0].message.content;
            }
          } catch (e) {
            console.warn('Error parsing streaming response line:', line, e);
          }
        }
        
        return fullContent.trim();
      }
      
      // Fallback for non-streaming responses
      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }

      console.warn('Unexpected API response format:', response.data);
      return '';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('API Axios error:', error.message);
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
      } else {
        console.error('API unknown error:', error);
      }
      return 'Error: Failed to communicate with the API. Check the console for details.';
    }
  }
}
