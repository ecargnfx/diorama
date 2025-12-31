// Replicate Image Generation API 
let lastGeneratedImageUrl: string | null = null;

// Base API Gateway URL - using proxy to avoid CORS
const BASE_API_GATEWAY_URL = "/api-gtw";

interface ControlsRef {
  text: string;
  width?: number;
  height?: number;
  aspect_ratio?: string;
}

interface TrellisOptions {
  texture_size?: number;
  mesh_simplify?: number;
  save_gaussian_ply?: boolean;
  ss_sampling_steps?: number;
  slat_sampling_steps?: number;
  generate_color?: boolean;
  generate_normal?: boolean;
  randomize_seed?: boolean;
  seed?: number;
  ss_guidance_strength?: number;
  slat_guidance_strength?: number;
  return_no_background?: boolean;
}

// Fetch with timeout helper
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 30000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/**
 * Generate an image from a prompt and upload it to S3 under userID/generations/
 * @param controlsRef - React ref containing the prompt text
 * @returns The S3 URL of the uploaded image
 */
export const requestGenerateImage = async (controlsRef: { current: ControlsRef }): Promise<string> => {
  const { text, width, height, aspect_ratio } = controlsRef.current;

  if (!text) {
    throw new Error("Prompt text is missing in controlsRef.current");
  }

  console.log("Generating image with prompt:", text, "size:", width, "x", height, "aspect_ratio:", aspect_ratio);

  // 1. Get auth token
  console.log('All cookies:', document.cookie); // DEBUG: See what cookies exist
  
  // TEMPORARY: Hardcoded token for testing
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImdyYWNlQHBsYXlob3VzZS5haSIsInVzZXJJRCI6NSwid2FsbGV0QWRkcmVzcyI6ImMzMjMwNzYxMzkzNjdhOTVlMTQ2NjE4OGZhZDg1MmJmNThlMWU0OWE3MjI0YmQ1MGQxN2IxYWU5ZTUzY2FiNzAiLCJleHAiOjE3NjcyOTY1NjZ9.tZh3R8TQWTp0ksZtP1EhoPpset-GnXxziarH7Rd7rdg'; // 👈 PASTE YOUR TOKEN HERE
  
  // Original cookie logic (commented out for testing)
  // const token = document.cookie.split('; ').find(row => row.startsWith('authToken='))?.split('=')[1] || null;
  // if (!token) {
  //   console.error('Available cookies:', document.cookie);
  //   throw new Error('No authentication token found. Please log in to Playhouse first.');
  // }
  console.log('Token found:', token ? 'Yes' : 'No');

  // 2. Get user info to extract userID
  const verifyRes = await fetch(`/auth-api/auth/verify`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!verifyRes.ok) {
    throw new Error('Token verification failed');
  }
  const userInfo = await verifyRes.json();
  const user_id = userInfo?.user?.userID;
  if (!user_id) {
    throw new Error('Invalid user info - missing userID');
  }

  // 3. Generate the image with width, height, and aspect_ratio
  const response = await fetch("/api-gtw/generate/generateImg", {
    method: "POST",
    headers: {
      'Authorization': `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      prompt: text,  
      prompt_upsampling: true,
      width: width || 1024,
      height: height || 1024,
      aspect_ratio: aspect_ratio || "1:1"
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Check content type to see if it's an image or JSON
  const contentType = response.headers.get('content-type');
  console.log('🔍 Response content-type:', contentType);
  
  let imageBlob;
  
  if (contentType && contentType.includes('image')) {
    // Response is the image itself - use it directly
    console.log('✅ Response is image data, using directly');
    imageBlob = await response.blob();
    
    // Create a temporary URL for the blob (for display purposes)
    lastGeneratedImageUrl = URL.createObjectURL(imageBlob);
    console.log('✅ Created blob URL:', lastGeneratedImageUrl);
  } else {
    // Response is JSON with URL
    console.log('🔍 Response is JSON, extracting URL');
    const responseData = await response.json();
    console.log('🔍 Response body:', responseData);
    
    lastGeneratedImageUrl = responseData.imageUrl || responseData.url || responseData.image_url || response.headers.get('X-Image-URL');
    
    if (!lastGeneratedImageUrl) {
      throw new Error('No image URL returned from generation API');
    }
    
    console.log('✅ Got image URL:', lastGeneratedImageUrl);
    
    // Download the image from the URL
    imageBlob = await fetch(lastGeneratedImageUrl).then(res => res.blob());
  }

  // 5. Generate a filename
  const filename = text
    .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase()
    .substring(0, 50); // Limit to 50 characters
  const uniqueFilename = `${filename}_${Date.now()}.png`;

  // 6. Request a presigned S3 upload URL for userID/generations/filename
  const assetType = "image";
  // Create asset in backend (optional, but matches AssetsModal flow)
  const createRes = await fetch(`/api-gtw/asset/create`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({
      user_id,
      assetType,
      name: uniqueFilename,
      description: `Generated image for prompt: ${text}` 
    }),
  });
  if (!createRes.ok) throw new Error('Failed to create asset');
  const createResData = await createRes.json();
  const asset_id = createResData.assetId;
  if (!asset_id) throw new Error('Failed to get assetId from creation response');

  // Get presigned upload URL
  const uploadRes = await fetch(`/api-gtw/asset/upload-component`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({
      assetId: asset_id,
      contentType: imageBlob.type || "image/png",
      componentType: assetType,
      extension: "png",
      // Specify the S3 key path: userID/generations/filename
      key: `${user_id}/generations/${uniqueFilename}` 
    }),
  });

  if (!uploadRes.ok) throw new Error('Failed to get upload URL');
  const { signedUrl, key } = await uploadRes.json();
  if (!signedUrl || !key) throw new Error('Invalid presigned URL response');

  // 7. Upload the image blob to S3
  const s3Upload = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': imageBlob.type || "image/png"
    },
    body: imageBlob,
  });

  if (!s3Upload.ok) {
    const errorText = await s3Upload.text();
    throw new Error(`S3 upload failed: ${errorText}`);
  }
 
  // 8. Retrieve the uploaded asset from S3
  try {
    // First get the component ID from the asset details
    const assetDetailsRes = await fetch(
      `/api-gtw/asset/${asset_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!assetDetailsRes.ok) {
      throw new Error('Failed to retrieve asset details');
    }

    const assetDetails = await assetDetailsRes.json();
    const componentId = assetDetails?.components?.[0]?.component_id;

    if (!componentId) {
      throw new Error('No component found for the uploaded asset');
    }

    // Now get the component download URL
    const componentRes = await fetch(
      `/api-gtw/asset/component/${componentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!componentRes.ok) {
      throw new Error('Failed to retrieve component details');
    }

    const componentData = await componentRes.json();
    const downloadUrl = componentData.signedUrl;

    if (!downloadUrl) {
      throw new Error('No download URL returned for the component');
    }

    console.log('Successfully retrieved uploaded asset from S3:', {
      assetId: asset_id,
      componentId: componentId,
      downloadUrl: downloadUrl,
      s3Key: key
    });

    console.log('🎨 RETURNING DOWNLOAD URL:', downloadUrl);
    console.log('🎨 URL is valid?', downloadUrl && downloadUrl.startsWith('http'));
    
    return downloadUrl;
  } catch (error) {
    console.error('Error retrieving uploaded asset:', error);
    throw error;
  }
}

/**
 * Get the last generated image URL (before S3 upload)
 * @returns The temporary image URL from generation
 */
export const getLastGeneratedImageUrl = (): string | null => lastGeneratedImageUrl;

/**
 * Generate a segmented image (background removed) from an image URL
 * @param imageUrl - The URL of the image to segment
 * @returns The URL of the segmented image
 */
export const generateSegmentedImage = async (imageUrl: string): Promise<string> => {
  console.log('🎨 Generating segmented image for:', imageUrl);

  // 1. Get auth token
  console.log('All cookies:', document.cookie); // DEBUG: See what cookies exist
  
  // TEMPORARY: Hardcoded token for testing (same as requestGenerateImage)
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImdyYWNlQHBsYXlob3VzZS5haSIsInVzZXJJRCI6NSwid2FsbGV0QWRkcmVzcyI6ImMzMjMwNzYxMzkzNjdhOTVlMTQ2NjE4OGZhZDg1MmJmNThlMWU0OWE3MjI0YmQ1MGQxN2IxYWU5ZTUzY2FiNzAiLCJleHAiOjE3NjcyOTY1NjZ9.tZh3R8TQWTp0ksZtP1EhoPpset-GnXxziarH7Rd7rdg'; // 👈 PASTE YOUR TOKEN HERE
  
  // Original cookie logic (commented out for testing)
  // const token = document.cookie.split('; ').find(row => row.startsWith('authToken='))?.split('=')[1] || null;
  // if (!token) {
  //   console.error('Available cookies:', document.cookie);
  //   throw new Error('No authentication token found. Please log in to Playhouse first.');
  // }
  console.log('Token found:', token ? 'Yes' : 'No');

  // 2. Get user info to extract userID
  const verifyRes = await fetch(`/auth-api/auth/verify`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!verifyRes.ok) {
    throw new Error('Token verification failed');
  }
  const userInfo = await verifyRes.json();
  const user_id = userInfo?.user?.userID;
  if (!user_id) {
    throw new Error('Invalid user info - missing userID');
  }

  // 3. Call segmentation API
  const url = "/api-gtw/generate/generateseg-from-uri";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}` 
    },
    body: JSON.stringify({
      image_url: imageUrl
    })
  });

  if (!response.ok) {
    throw new Error(`Segmentation failed! status: ${response.status}`);
  }

  // Check response content type
  const contentType = response.headers.get('content-type');
  console.log('🎨 Response content-type:', contentType);
  
  // Try to get URL from headers first
  let segmentedImageUrl = response.headers.get('X-Image-URL');
  console.log('🎨 Segmented image URL from headers:', segmentedImageUrl);

  // If not in headers, check if response is JSON with URL
  if (!segmentedImageUrl && contentType && contentType.includes('application/json')) {
    const responseData = await response.json();
    console.log('🎨 Response body:', responseData);
    segmentedImageUrl = responseData.url || responseData.imageUrl || responseData.image_url || responseData.segmented_url;
  }

  // If still no URL, the response might be the image blob itself
  if (!segmentedImageUrl && contentType && contentType.includes('image')) {
    console.log('🎨 Response is image blob, creating object URL');
    const blob = await response.blob();
    segmentedImageUrl = URL.createObjectURL(blob);
    console.log('🎨 Created blob URL:', segmentedImageUrl);
  }

  if (!segmentedImageUrl) {
    throw new Error('No segmented image URL returned from API');
  }

  console.log('✅ Segmented image generated successfully');
  return segmentedImageUrl;
};

/**
 * Generate a 3D model from an image using Trellis API
 * @param imageUrl - The URL of the image to convert to 3D
 * @param options - Optional Trellis parameters
 * @returns The model file URL
 */
export const generateTrellisModel = async (imageUrl: string, options: TrellisOptions = {}): Promise<string> => {
  const INITIATE_URL = `${BASE_API_GATEWAY_URL}/generate/generatetrellis/initiate`;

  // Default Trellis input parameters
  const trellisInput: any = {
    images: [imageUrl],
    texture_size: options.texture_size || 1024,
    mesh_simplify: options.mesh_simplify || 0.95,
    generate_model: true,
    save_gaussian_ply: options.save_gaussian_ply || false,
    ss_sampling_steps: options.ss_sampling_steps || 12,
    slat_sampling_steps: options.slat_sampling_steps || 12,
    generate_color: options.generate_color || true,
    generate_normal: options.generate_normal || false,
    randomize_seed: options.randomize_seed !== undefined ? options.randomize_seed : true,
    ss_guidance_strength: options.ss_guidance_strength || 7.5,
    slat_guidance_strength: options.slat_guidance_strength || 3.0,
    return_no_background: options.return_no_background || false,
  };
  if (trellisInput.randomize_seed === false && options.seed !== undefined) {
    trellisInput.seed = options.seed;
  }

  console.log('🎲 Initiating Trellis model generation for:', imageUrl, 'with options:', trellisInput);

  try {
    // Step 1: Initiate 3D model generation
    const initiateResponse = await fetchWithTimeout(INITIATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trellisInput)
    }, 30000);

    if (!initiateResponse.ok) {
      const errorText = await initiateResponse.text();
      throw new Error(`Failed to initiate Trellis: ${initiateResponse.status} - ${errorText}`);
    }

    const initiateResult = await initiateResponse.json();
    const { prediction_id, status_check_endpoint } = initiateResult;
    console.log(`🎲 Trellis initiated. Prediction ID: ${prediction_id}. Status endpoint: ${status_check_endpoint}`);

    // Fix status endpoint if it doesn't have /generate/ prefix
    const fixedStatusEndpoint = status_check_endpoint.startsWith('/generate/') 
      ? status_check_endpoint 
      : status_check_endpoint.replace('/generatetrellis/', '/generate/generatetrellis/');
    console.log(`🎲 Fixed status endpoint: ${fixedStatusEndpoint}`);

    // Step 2: Poll for status until succeeded or failed
    let modelFileUrl = null;
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 180; // 30 minutes
    const POLL_INTERVAL_MS = 10000; // 10 seconds

    console.log('🎲 Starting polling for Trellis model generation status...');
    while (pollAttempts < MAX_POLL_ATTEMPTS) {
      pollAttempts++;
      console.log(`🎲 Polling status (attempt ${pollAttempts}/${MAX_POLL_ATTEMPTS}) for prediction ID: ${prediction_id}`);

      const statusResponse = await fetchWithTimeout(`${BASE_API_GATEWAY_URL}${fixedStatusEndpoint}`, {
        method: "GET"
      }, 15000);

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(`Failed to get Trellis status: ${statusResponse.status} - ${errorText}`);
      }

      const statusResult = await statusResponse.json();
      console.log('🎲 Current Trellis status:', statusResult.status);

      if (statusResult.status === 'succeeded') {
        modelFileUrl = statusResult.model_file_url;
        console.log('✅ Trellis generation succeeded. Model File URL:', modelFileUrl);
        break;
      } else if (statusResult.status === 'failed' || statusResult.status === 'canceled') {
        throw new Error(`Trellis generation ${statusResult.status}: ${statusResult.detail || 'Unknown error'}`);
      } else {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    if (!modelFileUrl) {
      throw new Error("Trellis model generation timed out after multiple retries");
    }

    // Step 3: Download the GLB model and upload to S3 for permanent storage
    console.log('🎲 Downloading GLB model from Replicate...');
    
    // Get auth token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImdyYWNlQHBsYXlob3VzZS5haSIsInVzZXJJRCI6NSwid2FsbGV0QWRkcmVzcyI6ImMzMjMwNzYxMzkzNjdhOTVlMTQ2NjE4OGZhZDg1MmJmNThlMWU0OWE3MjI0YmQ1MGQxN2IxYWU5ZTUzY2FiNzAiLCJleHAiOjE3NjcyOTY1NjZ9.tZh3R8TQWTp0ksZtP1EhoPpset-GnXxziarH7Rd7rdg';
    
    // Get user info
    const verifyRes = await fetch(`/auth-api/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!verifyRes.ok) throw new Error('Token verification failed');
    const userInfo = await verifyRes.json();
    const user_id = userInfo?.user?.userID;
    if (!user_id) throw new Error('Invalid user info - missing userID');

    // Download the model
    const modelResponse = await fetchWithTimeout(modelFileUrl, { method: "GET" }, 120000);
    if (!modelResponse.ok) {
      throw new Error(`Failed to download model: ${modelResponse.status}`);
    }
    const modelBlob = await modelResponse.blob();

    // Generate S3 key
    const uniqueFilename = `model_${Date.now()}.glb`;
    const s3Key = `${user_id}/glb/${uniqueFilename}`;

    // Create asset in backend
    const createRes = await fetch(`${BASE_API_GATEWAY_URL}/asset/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({
        user_id,
        assetType: "mesh",
        name: uniqueFilename,
        description: `Generated 3D model from Trellis` 
      }),
    });
    if (!createRes.ok) throw new Error('Failed to create asset');
    const createResData = await createRes.json();
    const asset_id = createResData.assetId;
    if (!asset_id) throw new Error('Failed to get assetId');

    // Get presigned upload URL
    const uploadRes = await fetch(`${BASE_API_GATEWAY_URL}/asset/upload-component`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({
        assetId: asset_id,
        contentType: "model/gltf-binary",
        componentType: "glb",
        extension: "glb",
        key: s3Key
      }),
    });
    if (!uploadRes.ok) throw new Error('Failed to get upload URL');
    const { signedUrl, key } = await uploadRes.json();
    if (!signedUrl || !key) throw new Error('Invalid presigned URL response');

    // Upload to S3
    console.log('🎲 Uploading GLB model to S3...');
    const s3Upload = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "model/gltf-binary" },
      body: modelBlob
    });
    if (!s3Upload.ok) {
      const errorText = await s3Upload.text();
      throw new Error(`S3 upload failed: ${errorText}`);
    }

    // Return CDN URL
    const cdnBase = "https://cdn.playhouse.ai/";
    const cdnUrl = `${cdnBase}${key.startsWith('/') ? key.substring(1) : key}`;
    
    console.log('✅ Trellis model uploaded to CDN:', cdnUrl);
    return cdnUrl;

  } catch (error) {
    console.error('❌ Error generating Trellis model:', error.message);
    throw error;
  }
};
