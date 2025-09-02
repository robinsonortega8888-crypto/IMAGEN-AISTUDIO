/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, GeneratedImage, Modality} from '@google/genai';

function main() {
  console.log('Application main function started.');
  
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY is not set in the environment variables.");
    }
    console.log('API key found.');

    const ai = new GoogleGenAI({apiKey});
    console.log('GoogleGenAI initialized.');

    // -------------------- CHOOSE AN IMAGEN MODEL -------------------------------------------------
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

    /**
     * Sets the loading state of a button, showing a spinner for feedback.
     * @param button The button element to modify.
     * @param isLoading Whether to show the loading state or not.
     * @param originalText The text to restore when loading is finished.
     */
    function setButtonLoadingState(button: HTMLButtonElement, isLoading: boolean, originalText: string) {
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner"></span>';
            button.classList.add('is-generating');
        } else {
            button.disabled = false;
            button.innerHTML = originalText;
            button.classList.remove('is-generating');
        }
    }

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
      console.log('generateAndDisplayImages called.');
      const originalButtonText = 'Generate';
      setButtonLoadingState(generateButton, true, originalButtonText);

      try {
          if (!promptInput || !aspectRatioSelect || !imageGallery || !numImagesInput) {
              throw new Error("One or more required UI elements could not be found.");
          }
          showMessage('PROCESSING... please wait');

          if (referenceImage) {
              await generateFromImageAndText();
          } else {
              await generateFromText();
          }
      } catch (error) {
          console.error("An unexpected error occurred during image generation:", error);
          const message = error instanceof Error ? error.message : "An unknown error occurred.";
          showMessage(`Error: ${message}`, true);
      } finally {
          setButtonLoadingState(generateButton, false, originalButtonText);
      }
    }

    async function generateFromText() {
        try {
            const prompt = promptInput.value;
            const aspectRatio = aspectRatioSelect.value as '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
            const numberOfImages = parseInt(numImagesInput.value, 10);

            const fetchResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0:generateImage?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: prompt,
                  aspectRatio: aspectRatio,
                  numberOfImages: numberOfImages,
                  outputMimeType: 'image/jpeg',
                  includeRaiReason: true,
                }),
              }
            );

            if (!fetchResponse.ok) {
                const errorData = await fetchResponse.json();
                console.error("API Error:", errorData);
                throw new Error(errorData.error?.message || `Request failed with status ${fetchResponse.status}`);
            }

            const response = await fetchResponse.json();
      
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
        setButtonLoadingState(modalAddButton, false, 'Add Object');
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

        const originalButtonText = 'Add Object';
        setButtonLoadingState(modalAddButton, true, originalButtonText);

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
            hideAddObjectModal(); // This already handles resetting the button
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
        setButtonLoadingState(videoModalGenerateButton, false, 'Generate Video');
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
        
        const originalButtonText = 'Generate Video';
        setButtonLoadingState(videoModalGenerateButton, true, originalButtonText);
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
                
                const response = await fetch(`${downloadLink}&key=${apiKey}`);
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
            const message = error instanceof Error ? error.message : 'Check the console for details.';
            videoModalResultContainer.innerHTML = `<p class="error-message">Failed to create video.<br>${message}</p>`;
        } finally {
            setButtonLoadingState(videoModalGenerateButton, false, 'Generate Video');
        }
    }

    // -------------------- EVENT LISTENERS --------------------
    if (generateButton) {
      generateButton.addEventListener('click', generateAndDisplayImages);
    }
    if (uploadButton) {
      uploadButton.addEventListener('click', () => fileInput.click());
    }
    if (fileInput) {
      fileInput.addEventListener('change', handleFileChange);
    }
    if (clearImageButton) {
      clearImageButton.addEventListener('click', handleClearImage);
    }
    // Add Object Modal events
    if (modalAddButton) {
        modalAddButton.addEventListener('click', handleInPlaceGeneration);
    }
    if (modalCancelButton) {
        modalCancelButton.addEventListener('click', hideAddObjectModal);
    }
    if (modalUploadButton) {
        modalUploadButton.addEventListener('click', () => modalFileInput.click());
    }
    if (modalFileInput) {
        modalFileInput.addEventListener('change', handleModalFileChange);
    }
    if (modalClearImageButton) {
        modalClearImageButton.addEventListener('click', handleModalClearImage);
    }
    // Create Video Modal events
    if (videoModalGenerateButton) {
        videoModalGenerateButton.addEventListener('click', attemptVideoGeneration);
    }
    if (videoModalCancelButton) {
        videoModalCancelButton.addEventListener('click', hideCreateVideoModal);
    }

    // -------------------- INITIALIZATION --------------------
    console.log('Event listeners attached and app initialized.');

  } catch (error) {
    console.error("Application initialization failed:", error);
    const controls = document.getElementById('controls');
    const gallery = document.getElementById('image-gallery');
    
    if (controls) {
      controls.classList.add('hidden');
    }
    if (gallery) {
      gallery.innerHTML = `<p style="color: #ff6b6b; font-weight: bold;">Application failed to start: The API_KEY environment variable is missing. Please go to your project settings (e.g., in Vercel), find the "Environment Variables" section, and add a variable named API_KEY with your key from Google AI Studio. After adding the key, you may need to redeploy your project.</p>`;
    }
  }
}

// Run initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', main);