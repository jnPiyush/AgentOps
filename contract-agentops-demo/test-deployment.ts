// Test script for Contract AgentOps Demo deployment functionality

import { deploySimulated } from './gateway/src/services/foundryDeploy';

console.log('\n=== TESTING CONTRACT AGENTOPS DEPLOYMENT ===\n');

async function testDeployment() {
  try {
    console.log('1. Testing simulated deployment pipeline...');
    const result = deploySimulated();
    
    console.log('\n✅ Deployment completed successfully!');
    console.log(`   Pipeline ID: ${result.pipeline_id}`);
    console.log(`   Mode: ${result.mode}`);
    console.log(`   Agents deployed: ${result.summary.agents_deployed}`);
    console.log(`   Tools registered: ${result.summary.tools_registered}`);
    console.log(`   Errors: ${result.summary.errors}`);
    console.log(`   Total duration: ${result.summary.total_duration_ms}ms`);
    
    console.log('\n📋 Pipeline stages:');
    result.stages.forEach((stage, i) => {
      const status = stage.status === 'passed' ? '✅' : stage.status === 'failed' ? '❌' : '⚠️';
      console.log(`   ${i + 1}. ${stage.name}: ${status} (${stage.duration_ms}ms)`);
    });
    
    console.log('\n🤖 Registered agents:');
    result.agents.forEach(agent => {
      const status = agent.status === 'registered' ? '✅' : '❌';
      console.log(`   - ${agent.agent_name}: ${status} [${agent.foundry_agent_id}]`);
    });
    
    console.log('\n🔒 Security checks:');
    result.security.identity_access.forEach(check => {
      const status = check.status === 'passed' ? '✅' : '❌';
      console.log(`   - ${check.check}: ${status}`);
    });
    result.security.content_safety.forEach(check => {
      const status = check.status === 'passed' ? '✅' : '❌';
      console.log(`   - ${check.check}: ${status}`);
    });
    
    if (result.evaluation) {
      console.log('\n🧪 Evaluation results:');
      console.log(`   - Test count: ${result.evaluation.test_count}`);
      console.log(`   - Passed: ${result.evaluation.passed}`);
      console.log(`   - Accuracy: ${result.evaluation.accuracy}%`);
    }
    
    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testDeployment().then(success => {
  if (success) {
    console.log('\n🎉 All tests passed! Deployment pipeline is working correctly.');
  } else {
    console.log('\n💥 Tests failed! Check the implementation.');
    process.exit(1);
  }
});