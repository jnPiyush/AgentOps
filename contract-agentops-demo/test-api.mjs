// Test script for REST API endpoints

async function testAPIEndpoints() {
  const baseUrl = 'http://localhost:8000';
  
  console.log('\n=== TESTING API ENDPOINTS ===\n');
  
  try {
    // Test 1: Health endpoint
    console.log('📡 Testing health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Health check passed:', health);
    } else {
      console.log('❌ Health check failed:', healthResponse.status);
    }
    
    // Test 2: Mode endpoint  
    console.log('\n🔧 Testing mode endpoint...');
    const modeResponse = await fetch(`${baseUrl}/api/deploy/mode`);
    if (modeResponse.ok) {
      const mode = await modeResponse.json();
      console.log('✅ Mode endpoint working:', mode);
    } else {
      console.log('❌ Mode endpoint failed:', modeResponse.status);
    }
    
    // Test 3: Pipeline deployment
    console.log('\n🚀 Testing deployment pipeline...');
    const deployResponse = await fetch(`${baseUrl}/api/deploy/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Deployment',
        agents: ['Contract Intake Agent']
      })
    });
    
    if (deployResponse.ok) {
      const deployment = await deployResponse.json();
      console.log('✅ Deployment pipeline working!');
      console.log(`   Pipeline ID: ${deployment.pipeline_id}`);
      console.log(`   Mode: ${deployment.mode}`);
      console.log(`   Agents deployed: ${deployment.summary.agents_deployed}`);
      console.log(`   Status: ${deployment.summary.errors === 0 ? 'Success' : 'Errors'}`);
      
      // Test 4: Status endpoint
      console.log('\n📊 Testing status endpoint...');
      const statusResponse = await fetch(`${baseUrl}/api/deploy/status/${deployment.pipeline_id}`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        console.log('✅ Status endpoint working');
        console.log(`   Status: ${status.status}`);
        console.log(`   Stages: ${status.stages.length}`);
      }
      
      return true;
    } else {
      console.log('❌ Deployment pipeline failed:', deployResponse.status);
      return false;
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    return false;
  }
}

// Run the API tests
testAPIEndpoints().then(success => {
  if (success) {
    console.log('\n🎉 All API tests passed! Gateway is working correctly.');
  } else {
    console.log('\n💥 API tests failed! Check the gateway.');
    process.exit(1);
  }
});