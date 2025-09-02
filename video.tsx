/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai';

function main() {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
          throw new Error("API_KEY is not set in the environment variables.");
        }
        const ai = new GoogleGenAI({apiKey});

        // -------------------- MODEL -------------------------------------------------
        const textAndImageToVideoModel = 'veo-2.0-generate-001';

        // -------------------- UI ELEMENTS -------------------------------------------------
        const sourceImage = document.getElementById('source-image') as HTMLImageElement;
        const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
        const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
        const resultContainer = document.getElementById('result-container');


        async function handleVideoGeneration() {
            if (!sourceImage.src || !promptInput.value || !resultContainer) return;

            const prompt = promptInput.value;
            generateButton.disabled = true;
            generateButton.textContent = 'GENERATING...';
            resultContainer.innerHTML = `<p class="loading-message">Initializing video generation...</p>`;

            try {
                const imageSrc = sourceImage.src;
                const [mimeTypeData, base64Data] = imageSrc.split(';base64,');
                if (!base64Data || !mimeTypeData) {
                    throw new Error("Invalid image data. Could not extract base64 content.");
                }
                const mimeType = mimeTypeData.replace('data:', '');

                let operation = await ai.models.generateVideos({
                    model: textAndImageToVideoModel,
                    prompt,
                    image: { imageBytes: base64Data, mimeType },
                    config: { numberOfVideos: 1 }
                });

                const startTime = Date.now();
                const loadingMessageElement = resultContainer.querySelector('.loading-message') as HTMLParagraphElement;

                while (!operation.done) {
                    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
                    if (loadingMessageElement) {
                        loadingMessageElement.innerHTML = `Processing video... Please wait.<br>This may take a few minutes.<br>(${elapsedSeconds}s elapsed)`;
                    }
                    // Poll every 10 seconds
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    operation = await ai.operations.getVideosOperation({ operation });
                }

                if (operation.error) {
                    console.error('Video generation operation failed:', operation.error);
                    throw new Error(`Video generation failed: ${operation.error.message || 'Unknown error'}`);
                }

                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

                if (downloadLink) {
                    if (loadingMessageElement) {
                        loadingMessageElement.textContent = 'Downloading video...';
                    }
                    const response = await fetch(`${downloadLink}&key=${apiKey}`);
                    if (!response.ok) {
                        throw new Error(`Failed to download video: ${response.statusText}`);
                    }
                    
                    const videoBlob = await response.blob();
                    const videoUrl = URL.createObjectURL(videoBlob);
                    
                    resultContainer.innerHTML = ''; // Clear loading message
                    
                    const videoElement = document.createElement('video');
                    videoElement.src = videoUrl;
                    videoElement.controls = true;
                    videoElement.autoplay = true;
                    videoElement.loop = true;
                    videoElement.setAttribute('aria-label', prompt);
                    resultContainer.appendChild(videoElement);

                } else {
                    console.error("Unexpected operation response:", operation);
                    throw new Error('Video generation finished, but no download link was provided.');
                }
            } catch (error) {
                console.error("Error generating video:", error);
                const message = error instanceof Error ? error.message : 'Check the console for details.';
                resultContainer.innerHTML = `<p class="error-message">Failed to create video.<br>${message}</p>`;
            } finally {
                generateButton.disabled = false;
                generateButton.textContent = 'Generate Video';
            }
        }

        // -------------------- GENERATION FLOW --------------------
        async function attemptVideoGeneration() {
            await handleVideoGeneration();
        }


        // -------------------- INITIALIZATION --------------------
        function initializePage() {
            const imageSrc = sessionStorage.getItem('videoGenerationImage');

            if (imageSrc && sourceImage) {
                sourceImage.src = imageSrc;
            } else {
                // Handle case where no image is provided
                alert('No image data found. Returning to gallery.');
                window.location.href = 'index.html';
            }

            if (generateButton) {
                generateButton.addEventListener('click', attemptVideoGeneration);
            }
        }

        initializePage();
    } catch (error) {
        console.error("Application initialization failed:", error);
        const resultContainer = document.getElementById('result-container');
        const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
        const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;

        const errorMessage = 'Application failed to start: The API_KEY environment variable is missing. Please go to your project settings (e.g., in Vercel), find the "Environment Variables" section, and add a variable named API_KEY with your key from Google AI Studio. After adding the key, you may need to redeploy your project.';

        if (resultContainer) {
            resultContainer.innerHTML = `<p class="error-message">${errorMessage}</p>`;
        }
        if (promptInput) {
            promptInput.disabled = true;
        }
        if (generateButton) {
            generateButton.disabled = true;
            generateButton.textContent = 'Unavailable';
        }
    }
}


// Run initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', main);