import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function to send WhatsApp messages
 * This runs on the server-side, avoiding CORS issues
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { number, type, message, mediaUrl } = req.body;

    // Validation
    if (!number || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: number and type'
      });
    }

    // Validate type
    const validTypes = ['text', 'image', 'video', 'audio', 'pdf'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Format phone number
    let formattedNumber = number.replace(/\D/g, '');
    
    if (formattedNumber.startsWith('0')) {
      formattedNumber = '94' + formattedNumber.substring(1);
    } else if (!formattedNumber.startsWith('94')) {
      formattedNumber = '94' + formattedNumber;
    }

    // Validate phone number length
    if (formattedNumber.length !== 11) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Expected 9-10 digits.'
      });
    }

    // Build API URL
    const params = new URLSearchParams({
      number: formattedNumber,
      type: type,
    });

    if (message) {
      params.append('message', message);
    }

    if (mediaUrl) {
      params.append('mediaUrl', mediaUrl);
    }

    const apiUrl = `https://api.geekhirusha.com/emptaskmanagement.php?${params.toString()}`;

    console.log('📱 [Server] Sending WhatsApp to:', formattedNumber);

    // Call WhatsApp API from server-side
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'TaskManagement-Vercel/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Server] WhatsApp API error:', response.status, errorText);
      
      return res.status(502).json({
        success: false,
        error: `WhatsApp API returned status ${response.status}`
      });
    }

    const responseData = await response.text();
    console.log('✅ [Server] WhatsApp sent successfully');

    return res.status(200).json({
      success: true,
      message: 'WhatsApp message sent successfully',
      data: responseData
    });

  } catch (error) {
    console.error('❌ [Server] Error sending WhatsApp:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
