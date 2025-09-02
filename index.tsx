/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, GeneratedImage, Modality} from '@google/genai';

function main() {
  try {
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

    // -------------------- CHOOSE AN IMAGEN MODEL -------------------------------------------------
    const textToImageModel = 'imagen-4.0-generate-001';
    const imageAndTextToImageModel = 'gemini-2.5-flash-image-preview';
    const textAndImageToVideoModel = 'veo-2.0-generate-001';

    // -------------------- GET UI ELEMENTS -------------------------------------------------
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
    const aspectRatioSelect = document.getElementById('aspect-ratio-select') as HTMLSelectElement;
    const numImagesInput = document.getElementById('num-images-input') as HTMLInputElement;
    const imageGallery = document.getElementById('image-gallery');
    const generateButton = document.getElementById('generate-button') as HTMLButtonElement;

    // New elements for image upload
    const uploadButton = document.getElementById('upload-button') as HTMLButtonElement;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
    const clearImageButton = document.getElementById('clear-image-button') as HTMLButtonElement;

    // Add Object Modal elements
    const addObjectModal = document.getElementById('add-object-modal');
    const modalPromptInput = document.getElementById('modal-prompt-input') as HTMLTextAreaElement;
    const modalAddButton = document.getElementById('modal-add-button') as HTMLButtonElement;
    const modalCancelButton = document.getElementById('modal-cancel-button') as HTMLButtonElement;
    const modalFileInput = document.getElementById('modal-file-input') as HTMLInputElement;
    const modalUploadButton = document.getElementById('modal-upload-button') as HTMLButtonElement;
    const modalImagePreview = document.getElementById('modal-image-preview') as HTMLImageElement;
    const modalClearImageButton = document.getElementById('modal-clear-image-button') as HTMLButtonElement;

    // Create Video Modal elements
    const createVideoModal = document.getElementById('create-video-modal');
    const videoModalSourceImage = document.getElementById('video-modal-source-image') as HTMLImageElement;
    const videoModalPromptInput = document.getElementById('video-modal-prompt-input') as HTMLTextAreaElement;
    const videoAspectRatioSelect = document.getElementById('video-aspect-ratio-select') as HTMLSelectElement;
    const videoModalResultContainer = document.getElementById('video-modal-result-container');
    const videoModalGenerateButton = document.getElementById('video-modal-generate-button') as HTMLButtonElement;
    const videoModalCancelButton = document.getElementById('video-modal-cancel-button') as HTMLButtonElement;


    let referenceImage: { base64Data: string; mimeType: string; width: number; height: number; } | null = null;
    let modalReferenceImage: { base64Data: string; mimeType: string; } | null = null;
    let targetImageElement: HTMLImageElement | null = null; // To hold the image being edited

    function getApiErrorMessage(error: any): string {
        const message = JSON.stringify(error);
        if (message.includes('RESOURCE_EXHAUSTED')) {
            return 'API quota exceeded. Please check your plan and billing details.';
        }
        return 'An error occurred. Check the console for details.';
    }

    function showMessage(message: string, isError = false) {
      if (imageGallery) {
          imageGallery.innerHTML = ''; // Clear previous content
          const messageElement = document.createElement('p');
          messageElement.textContent = message;
          if (isError) {
              messageElement.style.color = '#ff6b6b'; // A reddish color for errors
          }
          imageGallery.appendChild(messageElement);
      }
    }

    async function handleFileChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];

        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                
                // Create a temporary image to get dimensions
                const img = new Image();
                img.onload = () => {
                    const [mimeType, base64Data] = result.split(';base64,');
                    referenceImage = { 
                        base64Data, 
                        mimeType, 
                        width: img.naturalWidth, 
                        height: img.naturalHeight 
                    };
                };
                img.src = result; // This triggers the onload

                imagePreview.src = result;
                imagePreview.classList.remove('hidden');
                clearImageButton.classList.remove('hidden');
                aspectRatioSelect.disabled = true;
            };
            reader.readAsDataURL(file);
        }
    }

    function handleClearImage() {
        referenceImage = null;
        fileInput.value = ''; // Reset file input
        imagePreview.src = '';
        imagePreview.classList.add('hidden');
        clearImageButton.classList.add('hidden');
        aspectRatioSelect.disabled = false;
    }


    async function generateAndDisplayImages() {
      if (!promptInput || !aspectRatioSelect || !imageGallery || !numImagesInput) return;
      
      generateButton.disabled = true; // Disable button while generating
      generateButton.textContent = 'GENERATING...';
      showMessage('PROCESSING... please wait');

      try {
        if (referenceImage) {
            await generateFromImageAndText();
        } else {
            await generateFromText();
        }
      } finally {
        generateButton.disabled = false; // Re-enable button
        generateButton.textContent = 'Generate';
      }
    }

    async function generateFromText() {
        try {
            const prompt = promptInput.value;
            const aspectRatio = aspectRatioSelect.value as '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
            const numberOfImages = parseInt(numImagesInput.value, 10);

            const response = await ai.models.generateImages({
              model: textToImageModel,
              prompt: prompt,
              config: {
                  numberOfImages: numberOfImages,
                  aspectRatio: aspectRatio,
                  outputMimeType: 'image/jpeg',
                  includeRaiReason: true,
              },
            });
      
            if (imageGallery && response?.generatedImages && response.generatedImages.length > 0) {
                imageGallery.innerHTML = '';
                response.generatedImages.forEach((generatedImage: GeneratedImage, index: number) => {
                    if (generatedImage.image?.imageBytes) {
                        const src = `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
                        const alt = `${prompt} - Image ${Number(index) + 1}`;
                        addImageToGallery(src, alt);
                    }
                });
            } else {
              showMessage('No images were generated. Please try a different prompt or settings.', true);
            }
        } catch (error) {
            console.error("Error generating images from text:", error);
            const friendlyMessage = getApiErrorMessage(error);
            showMessage(`Error: ${friendlyMessage}`, true);
        }
    }

    async function generateFromImageAndText() {
        if (!referenceImage) return;

        try {
            const imagePart = {
                inlineData: {
                    data: referenceImage.base64Data,
                    mimeType: referenceImage.mimeType.replace('data:', ''),
                },
            };
            const userPrompt = promptInput.value;
            // Add instructions to the prompt to preserve aspect ratio
            const promptWithRatio = `${userPrompt}. Preserve the original aspect ratio of the image (${referenceImage.width}x${referenceImage.height}). Do not crop the image.`;
            const textPart = { text: promptWithRatio };
            const numberOfImages = parseInt(numImagesInput.value, 10);

            if (imageGallery) {
              imageGallery.innerHTML = ''; // Clear "loading" message
            }

            let imagesGenerated = 0;
            // This model does not support candidateCount, so we loop.
            for (let i = 0; i < numberOfImages; i++) {
                const response = await ai.models.generateContent({
                    model: imageAndTextToImageModel,
                    contents: { parts: [imagePart, textPart] },
                    config: {
                        responseModalities: [Modality.IMAGE, Modality.TEXT],
                    },
                });
        
                // Each response will have one candidate
                const imagePartResponse = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
                if (imagePartResponse?.inlineData) {
                    const src = `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`;
                    const alt = `${promptInput.value} - Edited Image ${i + 1}`;
                    addImageToGallery(src, alt);
                    imagesGenerated++;
                }
            }
            
            if (imagesGenerated === 0) {
                showMessage('No images were generated from the reference photo. Please try a different prompt or image.', true);
            }
        } catch (error) {
            console.error("Error generating images from image and text:", error);
            const friendlyMessage = getApiErrorMessage(error);
            showMessage(`Error: ${friendlyMessage}`, true);
        }
    }

    function createActionButtons(img: HTMLImageElement): HTMLElement {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'image-actions';

        const addObjectButton = document.createElement('button');
        addObjectButton.textContent = 'Add Object';
        addObjectButton.className = 'add-object-button';
        addObjectButton.setAttribute('aria-label', 'Add an object to this image');
        addObjectButton.addEventListener('click', () => showAddObjectModal(img));

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download';
        downloadButton.className = 'download-button';
        downloadButton.setAttribute('aria-label', 'Download this image');
        downloadButton.addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = img.src;
            const filename = (img.alt || 'generated-image').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase() + '.jpeg';
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        const createVideoButton = document.createElement('button');
        createVideoButton.textContent = 'Create as Video';
        createVideoButton.className = 'create-video-button';
        createVideoButton.setAttribute('aria-label', 'Create a video from this image');
        createVideoButton.addEventListener('click', () => showCreateVideoModal(img));

        actionsContainer.appendChild(addObjectButton);
        actionsContainer.appendChild(downloadButton);
        actionsContainer.appendChild(createVideoButton);

        return actionsContainer;
    }


    function addImageToGallery(src: string, alt: string) {
        if (!imageGallery) return;

        const container = document.createElement('div');
        container.className = 'image-container';

        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';

        const img = new Image();
        img.src = src;
        img.alt = alt;
        img.setAttribute('aria-label', alt);

        const actionsContainer = createActionButtons(img);

        wrapper.appendChild(img);
        wrapper.appendChild(actionsContainer);
        container.appendChild(wrapper);

        imageGallery.appendChild(container);
    }

    // -------------------- ADD OBJECT MODAL LOGIC --------------------

    function showAddObjectModal(imageElement: HTMLImageElement) {
        if (!addObjectModal || !modalPromptInput) return;
        targetImageElement = imageElement;
        modalPromptInput.value = ''; // Clear previous prompt
        addObjectModal.classList.remove('hidden');
        modalPromptInput.focus();
    }

    function hideAddObjectModal() {
        if (!addObjectModal) return;
        addObjectModal.classList.add('hidden');
        targetImageElement = null;
        modalPromptInput.value = '';
        modalAddButton.disabled = false;
        modalAddButton.textContent = 'Add Object';
        handleModalClearImage(); // Also clear the object image
    }

    async function handleModalFileChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];

        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const [mimeType, base64Data] = result.split(';base64,');
                modalReferenceImage = { base64Data, mimeType };

                modalImagePreview.src = result;
                modalImagePreview.classList.remove('hidden');
                modalClearImageButton.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    }

    function handleModalClearImage() {
        modalReferenceImage = null;
        modalFileInput.value = ''; // Reset file input
        modalImagePreview.src = '';
        modalImagePreview.classList.add('hidden');
        modalClearImageButton.classList.add('hidden');
    }

    async function handleInPlaceGeneration() {
        if (!targetImageElement || !modalPromptInput.value) {
            alert('Please enter a prompt to add an object.');
            return;
        }

        modalAddButton.disabled = true;
        modalAddButton.textContent = 'Adding...';

        const imageSrc = targetImageElement.src;
        const [mimeTypeData, base64Data] = imageSrc.split(';base64,');
        if (!base64Data || !mimeTypeData) {
            console.error("Could not use image as reference: invalid data URL format.");
            alert('There was an issue with the source image data.');
            hideAddObjectModal(); // Hide modal on error
            return;
        }
        const mimeType = mimeTypeData.replace('data:', '');

        // Get original dimensions to preserve aspect ratio
        const originalWidth = targetImageElement.naturalWidth;
        const originalHeight = targetImageElement.naturalHeight;

        try {
            const parts = [];
            // 1. Add base image
            parts.push({ inlineData: { data: base64Data, mimeType } });

            // 2. Add uploaded object image if it exists
            if (modalReferenceImage) {
                parts.push({
                    inlineData: {
                        data: modalReferenceImage.base64Data,
                        mimeType: modalReferenceImage.mimeType.replace('data:', ''),
                    }
                });
            }
            
            // 3. Add text prompt with aspect ratio instruction
            const userPrompt = modalPromptInput.value;
            const promptWithRatio = `${userPrompt}. Preserve the original aspect ratio of the image (${originalWidth}x${originalHeight}). Do not crop the image.`;
            parts.push({ text: promptWithRatio });

            const response = await ai.models.generateContent({
                model: imageAndTextToImageModel,
                contents: { parts },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const imagePartResponse = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
            if (imagePartResponse?.inlineData && targetImageElement) {
                const newSrc = `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`;
                targetImageElement.src = newSrc; // Update the image in the gallery
            } else {
              alert('Could not generate a new image. Please try a different prompt.');
            }
        } catch (error) {
            console.error("Error during in-place generation:", error);
            const friendlyMessage = getApiErrorMessage(error);
            alert(`An error occurred: ${friendlyMessage}`);
        } finally {
            hideAddObjectModal(); // Hide modal regardless of success or failure
        }
    }

    // -------------------- VIDEO MODAL LOGIC --------------------

    function showCreateVideoModal(imageElement: HTMLImageElement) {
        if (!createVideoModal || !videoModalSourceImage) return;
        videoModalSourceImage.src = imageElement.src;
        createVideoModal.classList.remove('hidden');
    }

    function hideCreateVideoModal() {
        if (!createVideoModal || !videoModalResultContainer) return;
        createVideoModal.classList.add('hidden');
        videoModalSourceImage.src = '';
        // Clear result and restore placeholder
        videoModalResultContainer.innerHTML = '<p class="placeholder">Your generated video will appear here.</p>';
        // Reset button state
        videoModalGenerateButton.disabled = false;
        videoModalGenerateButton.textContent = 'Generate Video';
    }

    async function attemptVideoGeneration() {
        await handleVideoGeneration();
    }

    async function handleVideoGeneration() {
        if (!videoModalSourceImage.src || !videoModalPromptInput.value || !videoModalResultContainer || !videoAspectRatioSelect) return;

        const userPrompt = videoModalPromptInput.value;
        const aspectRatio = videoAspectRatioSelect.value;
        // Append the aspect ratio instruction to the user's prompt
        const prompt = `${userPrompt} Generate the video in a ${aspectRatio} aspect ratio.`;

        videoModalGenerateButton.disabled = true;
        videoModalGenerateButton.textContent = 'GENERATING...';
        videoModalResultContainer.innerHTML = `<p class="loading-message">Initializing video generation...</p>`;

        try {
            const imageSrc = videoModalSourceImage.src;
            const [mimeTypeData, base64Data] = imageSrc.split(';base64,');
            if (!base64Data || !mimeTypeData) {
                throw new Error("Invalid image data. Could not extract base64 content.");
            }
            const mimeType = mimeTypeData.replace('data:', '');

            let operation = await ai.models.generateVideos({
                model: textAndImageToVideoModel,
                prompt,
                image: { imageBytes: base64Data, mimeType },
                config: { 
                    numberOfVideos: 1,
                }
            });

            const startTime = Date.now();
            const loadingMessageElement = videoModalResultContainer.querySelector('.loading-message') as HTMLParagraphElement;

            while (!operation.done) {
                const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
                if (loadingMessageElement) {
                    loadingMessageElement.innerHTML = `Processing video... Please wait.<br>This may take a few minutes.<br>(${elapsedSeconds}s elapsed)`;
                }
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
                const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                if (!response.ok) {
                    throw new Error(`Failed to download video: ${response.statusText}`);
                }
                
                const videoBlob = await response.blob();
                const videoUrl = URL.createObjectURL(videoBlob);
                
                videoModalResultContainer.innerHTML = ''; // Clear loading message
                
                const videoElement = document.createElement('video');
                videoElement.src = videoUrl;
                videoElement.controls = true;
                videoElement.autoplay = true;
                videoElement.loop = true;
                videoElement.setAttribute('aria-label', prompt);
                videoModalResultContainer.appendChild(videoElement);

            } else {
                console.error("Unexpected operation response:", operation);
                throw new Error('Video generation finished, but no download link was provided.');
            }
        } catch (error) {
            console.error("Error generating video:", error);
            const message = error instanceof Error ? error.message : getApiErrorMessage(error);
            videoModalResultContainer.innerHTML = `<p class="error-message">Failed to create video.<br>${message}</p>`;
        } finally {
            videoModalGenerateButton.disabled = false;
            videoModalGenerateButton.textContent = 'Generate Video';
        }
    }

    // -------------------- EVENT LISTENERS --------------------
    // Add Object Modal
    modalAddButton.addEventListener('click', handleInPlaceGeneration);
    modalCancelButton.addEventListener('click', hideAddObjectModal);
    modalUploadButton.addEventListener('click', () => modalFileInput.click());
    modalFileInput.addEventListener('change', handleModalFileChange);
    modalClearImageButton.addEventListener('click', handleModalClearImage);

    // Create Video Modal
    videoModalGenerateButton.addEventListener('click', attemptVideoGeneration);
    videoModalCancelButton.addEventListener('click', hideCreateVideoModal);

    // Main control event listeners
    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileChange);
    clearImageButton.addEventListener('click', handleClearImage);
    generateButton.addEventListener('click', generateAndDisplayImages);

  } catch (error) {
    console.error("Application initialization failed:", error);
    const imageGallery = document.getElementById('image-gallery');
    const controls = document.getElementById('controls');
    const generateButton = document.getElementById('generate-button') as HTMLButtonElement;

    const errorMessage = 'There was a problem starting the application. This is likely due to a missing API key or configuration issue. Please check the deployment settings.';

    if (imageGallery) {
        imageGallery.innerHTML = '';
        const messageElement = document.createElement('p');
        messageElement.textContent = errorMessage;
        messageElement.style.color = '#ff6b6b';
        messageElement.style.textAlign = 'center';
        imageGallery.appendChild(messageElement);
    }

    if (controls) {
      const allControls = controls.querySelectorAll('button, input, select, textarea');
      allControls.forEach(el => (el as HTMLButtonElement).disabled = true);
    }
    
    if (generateButton) {
      generateButton.textContent = 'Unavailable';
    }
  }
}

document.addEventListener('DOMContentLoaded', main);