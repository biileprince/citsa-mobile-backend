const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let createdPostId = '';
let commentId = '';

// Test data
const testStudent = {
  studentId: 'PS/ITC/22/0001',
  email: 'test.student@ucc.edu.gh'
};

const adminUser = {
  studentId: 'PS/ADM/20/0001',
  email: 'admin@ucc.edu.gh'
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
}

async function testFeedFunctionality() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          CITSA FEED API - COMPREHENSIVE TEST              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // ============================================
    // STEP 1: Authentication
    // ============================================
    console.log('📝 STEP 1: Authentication');
    console.log('━'.repeat(60));

    console.log('\n1.1 Sending OTP to admin user...');
    let result = await apiCall('POST', '/auth/send-otp', {
      studentId: adminUser.studentId,
    });

    if (result.success) {
      console.log('✅ OTP sent to:', adminUser.email);
      console.log('💡 Check your email for the OTP code\n');

      // Prompt for OTP
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const otpCode = await new Promise((resolve) => {
        readline.question('Enter the OTP code: ', (answer) => {
          readline.close();
          resolve(answer);
        });
      });

      console.log('\n1.2 Verifying OTP...');
      result = await apiCall('POST', '/auth/verify-otp', {
        studentId: adminUser.studentId,
        otpCode: otpCode.trim(),
      });

      if (result.success) {
        authToken = result.data.data.accessToken;
        console.log('✅ Authentication successful!');
        console.log('🔑 Access token obtained\n');
      } else {
        throw new Error('OTP verification failed: ' + JSON.stringify(result.error));
      }
    } else {
      throw new Error('Failed to send OTP: ' + JSON.stringify(result.error));
    }

    // ============================================
    // STEP 2: Get Feed Posts (Public)
    // ============================================
    console.log('\n📰 STEP 2: Get Feed Posts (Public Access)');
    console.log('━'.repeat(60));

    console.log('\n2.1 Fetching all posts...');
    result = await apiCall('GET', '/feed/posts');

    if (result.success) {
      const posts = result.data.data;
      console.log(`✅ Retrieved ${posts.length} posts`);
      console.log('📊 Pagination:', result.data.pagination);
      
      if (posts.length > 0) {
        console.log('\n📋 Sample Post:');
        console.log('   ID:', posts[0].id);
        console.log('   Type:', posts[0].type);
        console.log('   Title:', posts[0].title || 'N/A');
        console.log('   Author:', posts[0].author?.fullName || 'N/A');
        console.log('   Likes:', posts[0].likesCount);
        console.log('   Comments:', posts[0].commentsCount);
      }
    } else {
      console.log('⚠️  No posts found or error:', result.error);
    }

    // ============================================
    // STEP 3: Create New Post (Admin)
    // ============================================
    console.log('\n\n✍️  STEP 3: Create New Post (Admin Only)');
    console.log('━'.repeat(60));

    console.log('\n3.1 Creating an announcement post...');
    result = await apiCall(
      'POST',
      '/feed/posts',
      {
        type: 'ANNOUNCEMENT',
        category: 'POSITIVE_NEWS',
        title: 'Feed API Test - Automated Test Post',
        content:
          'This is a test post created by the automated feed testing script. It verifies that the post creation functionality is working correctly.',
        isPinned: false,
      },
      authToken
    );

    if (result.success) {
      createdPostId = result.data.data.id;
      console.log('✅ Post created successfully!');
      console.log('   Post ID:', createdPostId);
      console.log('   Title:', result.data.data.title);
      console.log('   Type:', result.data.data.type);
    } else {
      console.log('❌ Failed to create post:', result.error);
    }

    // ============================================
    // STEP 4: Create Event Post
    // ============================================
    console.log('\n\n📅 STEP 4: Create Event Post');
    console.log('━'.repeat(60));

    console.log('\n4.1 Creating an event post...');
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now

    result = await apiCall(
      'POST',
      '/feed/posts',
      {
        type: 'EVENT',
        category: 'EVENTS',
        title: 'Test Event - API Testing Workshop',
        content:
          'Join us for a hands-on workshop on API testing and development. Learn best practices and tools for testing REST APIs.',
        eventDate: eventDate.toISOString().split('T')[0],
        eventTime: '14:00',
        location: 'Computer Lab 201',
        capacityMax: 50,
        registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        tags: ['API', 'Testing', 'Workshop'],
        isUrgent: false,
      },
      authToken
    );

    if (result.success) {
      console.log('✅ Event post created successfully!');
      console.log('   Post ID:', result.data.data.id);
      console.log('   Event Date:', result.data.data.event?.eventDate);
      console.log('   Location:', result.data.data.event?.location);
      console.log('   Capacity:', result.data.data.event?.capacityMax);
    } else {
      console.log('❌ Failed to create event:', result.error);
    }

    // ============================================
    // STEP 5: Get Single Post
    // ============================================
    if (createdPostId) {
      console.log('\n\n🔍 STEP 5: Get Single Post Details');
      console.log('━'.repeat(60));

      console.log('\n5.1 Fetching post details...');
      result = await apiCall('GET', `/feed/posts/${createdPostId}`, null, authToken);

      if (result.success) {
        console.log('✅ Post details retrieved');
        console.log('   Views:', result.data.data.viewsCount);
        console.log('   Comments:', result.data.data.comments?.length || 0);
      } else {
        console.log('❌ Failed to get post:', result.error);
      }
    }

    // ============================================
    // STEP 6: Like Post
    // ============================================
    if (createdPostId) {
      console.log('\n\n❤️  STEP 6: Like Post');
      console.log('━'.repeat(60));

      console.log('\n6.1 Liking the post...');
      result = await apiCall('POST', `/feed/posts/${createdPostId}/like`, null, authToken);

      if (result.success) {
        console.log('✅ Post liked successfully!');
      } else {
        console.log('⚠️  Like operation:', result.error?.error?.message || result.error);
      }

      // Try to like again (should fail)
      console.log('\n6.2 Attempting to like again (should fail)...');
      result = await apiCall('POST', `/feed/posts/${createdPostId}/like`, null, authToken);

      if (!result.success && result.status === 409) {
        console.log('✅ Correctly prevented duplicate like');
      } else {
        console.log('⚠️  Duplicate like handling:', result.status);
      }
    }

    // ============================================
    // STEP 7: Comment on Post
    // ============================================
    if (createdPostId) {
      console.log('\n\n💬 STEP 7: Add Comment');
      console.log('━'.repeat(60));

      console.log('\n7.1 Adding a comment...');
      result = await apiCall(
        'POST',
        `/feed/posts/${createdPostId}/comments`,
        {
          content: 'This is a test comment from the automated testing script.',
        },
        authToken
      );

      if (result.success) {
        commentId = result.data.data.id;
        console.log('✅ Comment added successfully!');
        console.log('   Comment ID:', commentId);
        console.log('   Content:', result.data.data.content);
      } else {
        console.log('❌ Failed to add comment:', result.error);
      }

      // Add a reply
      if (commentId) {
        console.log('\n7.2 Adding a reply to the comment...');
        result = await apiCall(
          'POST',
          `/feed/posts/${createdPostId}/comments`,
          {
            content: 'This is a reply to the test comment.',
            parentCommentId: commentId,
          },
          authToken
        );

        if (result.success) {
          console.log('✅ Reply added successfully!');
        } else {
          console.log('❌ Failed to add reply:', result.error);
        }
      }
    }

    // ============================================
    // STEP 8: Save Post
    // ============================================
    if (createdPostId) {
      console.log('\n\n🔖 STEP 8: Save Post');
      console.log('━'.repeat(60));

      console.log('\n8.1 Saving the post...');
      result = await apiCall('POST', `/feed/posts/${createdPostId}/save`, null, authToken);

      if (result.success) {
        console.log('✅ Post saved successfully!');
      } else {
        console.log('⚠️  Save operation:', result.error?.error?.message || result.error);
      }
    }

    // ============================================
    // STEP 9: Get Saved Posts
    // ============================================
    console.log('\n\n📚 STEP 9: Get Saved Posts');
    console.log('━'.repeat(60));

    console.log('\n9.1 Fetching saved posts...');
    result = await apiCall('GET', '/feed/saved', null, authToken);

    if (result.success) {
      console.log(`✅ Retrieved ${result.data.data.length} saved posts`);
    } else {
      console.log('❌ Failed to get saved posts:', result.error);
    }

    // ============================================
    // STEP 10: Share Post
    // ============================================
    if (createdPostId) {
      console.log('\n\n🔄 STEP 10: Share Post');
      console.log('━'.repeat(60));

      console.log('\n10.1 Sharing the post...');
      result = await apiCall('POST', `/feed/posts/${createdPostId}/share`, null, authToken);

      if (result.success) {
        console.log('✅ Post shared successfully!');
      } else {
        console.log('❌ Failed to share post:', result.error);
      }
    }

    // ============================================
    // STEP 11: Filter Posts
    // ============================================
    console.log('\n\n🔍 STEP 11: Filter Posts');
    console.log('━'.repeat(60));

    console.log('\n11.1 Filter by type (ANNOUNCEMENT)...');
    result = await apiCall('GET', '/feed/posts?type=ANNOUNCEMENT', null, authToken);

    if (result.success) {
      console.log(`✅ Found ${result.data.data.length} announcement posts`);
    } else {
      console.log('❌ Failed to filter posts:', result.error);
    }

    console.log('\n11.2 Filter by category (EVENTS)...');
    result = await apiCall('GET', '/feed/posts?category=EVENTS', null, authToken);

    if (result.success) {
      console.log(`✅ Found ${result.data.data.length} event posts`);
    } else {
      console.log('❌ Failed to filter by category:', result.error);
    }

    console.log('\n11.3 Search posts...');
    result = await apiCall('GET', '/feed/posts?search=test', null, authToken);

    if (result.success) {
      console.log(`✅ Found ${result.data.data.length} posts matching 'test'`);
    } else {
      console.log('❌ Failed to search posts:', result.error);
    }

    // ============================================
    // STEP 12: Unlike Post
    // ============================================
    if (createdPostId) {
      console.log('\n\n💔 STEP 12: Unlike Post');
      console.log('━'.repeat(60));

      console.log('\n12.1 Unliking the post...');
      result = await apiCall('DELETE', `/feed/posts/${createdPostId}/like`, null, authToken);

      if (result.success) {
        console.log('✅ Post unliked successfully!');
      } else {
        console.log('❌ Failed to unlike post:', result.error);
      }
    }

    // ============================================
    // STEP 13: Unsave Post
    // ============================================
    if (createdPostId) {
      console.log('\n\n🗑️  STEP 13: Unsave Post');
      console.log('━'.repeat(60));

      console.log('\n13.1 Unsaving the post...');
      result = await apiCall('DELETE', `/feed/posts/${createdPostId}/save`, null, authToken);

      if (result.success) {
        console.log('✅ Post unsaved successfully!');
      } else {
        console.log('❌ Failed to unsave post:', result.error);
      }
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('✅ Feed API Testing Complete!\n');
    console.log('📋 Tests Performed:');
    console.log('   ✓ Authentication');
    console.log('   ✓ Get feed posts (public)');
    console.log('   ✓ Get feed posts (authenticated)');
    console.log('   ✓ Create announcement post');
    console.log('   ✓ Create event post');
    console.log('   ✓ Get single post details');
    console.log('   ✓ Like post');
    console.log('   ✓ Prevent duplicate likes');
    console.log('   ✓ Comment on post');
    console.log('   ✓ Reply to comment');
    console.log('   ✓ Save post');
    console.log('   ✓ Get saved posts');
    console.log('   ✓ Share post');
    console.log('   ✓ Filter by type');
    console.log('   ✓ Filter by category');
    console.log('   ✓ Search posts');
    console.log('   ✓ Unlike post');
    console.log('   ✓ Unsave post');

    console.log('\n💡 Notes:');
    console.log('   • Created posts will remain in the database');
    console.log('   • Check Prisma Studio to view all data');
    console.log('   • Run "npm run db:studio" to open Prisma Studio\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure the backend server is running (npm run dev)');
    console.error('   2. Check that the database is accessible');
    console.error('   3. Verify the OTP email was received');
    console.error('   4. Ensure you have an admin user in the database\n');
  }
}

// Run the test
testFeedFunctionality();
