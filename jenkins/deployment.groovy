/*
Use the following Groovy script in the Extended Choice Parameter with , as delimiter:

def list = []
jobs = jenkins.getAllItems()
jobs.each { job ->
  name = job.fullName
  if (name.contains('Windows Internal') || name.contains('Wrapper_Linux') || name.contains('Wrapper_macOS')) {
  builds = job.builds
  for (i = 0; i <5; i++) {
    lastbuild = job.builds[i]
    if (lastbuild) {
    list << name + '#' + lastbuild.displayName
    }
  }
  }
}
return list

Add additional choice parameter "Release" with:
Internal
Production
Custom (needs special env variables)
*/
node('master') {
  def jenkinsbot_secret = ''
  withCredentials([string(credentialsId: 'JENKINSBOT_WRAPPER_CHAT', variable: 'JENKINSBOT_SECRET')]) {
    jenkinsbot_secret = env.JENKINSBOT_SECRET
  }

  stage('Checkout & Clean') {
    git branch: "${GIT_BRANCH}", url: 'https://github.com/wireapp/wire-desktop.git'
    sh returnStatus: true, script: 'rm -rf wrap/ info.json *.pkg'
  }

  def projectName = env.WRAPPER_BUILD.tokenize('#')[0]
  def version = env.WRAPPER_BUILD.tokenize('#')[1]
  def NODE = tool name: 'node-v10.15.3', type: 'nodejs'

  stage('Get build artifacts') {
    try {
      step ([$class: 'CopyArtifact',
      projectName: "$projectName",
      selector: [$class: 'SpecificBuildSelector', buildNumber: "$version"],
      filter: '*.pkg,wrap/**']);
    } catch (e) {
      wireSend secret: "$jenkinsbot_secret", message: "**Could not get build artifacts from of ${version} from ${projectName}** see: ${JOB_URL}"
      throw e
    }
  }

  currentBuild.displayName = "Deploy $projectName " + version

  stage('Install dependencies') {
    try {
      withEnv(["PATH+NODE=${NODE}/bin"]) {
        sh 'node -v'
        sh 'npm -v'
        sh 'npm install -g yarn'
        sh 'yarn --ignore-scripts'
      }
    } catch (e) {
      wireSend secret: "$jenkinsbot_secret", message: "**Could not get build artifacts from of ${version} from ${projectName}** see: ${JOB_URL}"
      throw e
    }
  }

  stage('Upload to S3 and/or Hockey') {
    withEnv(["PATH+NODE=${NODE}/bin"]) {
      if (projectName.contains('Windows')) {
        parallel hockey: {
          try {
            if (params.Release.equals('Production')) {
              withCredentials([string(credentialsId: 'WIN_PROD_HOCKEY_TOKEN', variable: 'WIN_PROD_HOCKEY_TOKEN'), string(credentialsId: 'WIN_PROD_HOCKEY_ID', variable: 'WIN_PROD_HOCKEY_ID')]) {
                sh 'node ./bin/hockey/win-prod-hockey.js'
              }
            } else if (params.Release.equals('Custom')) {
              withCredentials([string(credentialsId: "${WIN_CUSTOM_HOCKEY_ID}", variable: 'WIN_CUSTOM_HOCKEY_ID'), string(credentialsId: "${WIN_CUSTOM_HOCKEY_TOKEN}", variable: 'WIN_CUSTOM_HOCKEY_TOKEN')]) {
                sh 'node ./bin/hockey/win-custom-hockey.js'
              }
            } else {
              withCredentials([string(credentialsId: 'WIN_HOCKEY_TOKEN', variable: 'WIN_HOCKEY_TOKEN'), string(credentialsId: 'WIN_HOCKEY_ID', variable: 'WIN_HOCKEY_ID')]) {
                sh 'node ./bin/hockey/win-internal-hockey.js'
              }
            }
          } catch(e) {
            currentBuild.result = 'FAILED'
            wireSend secret: "$jenkinsbot_secret", message: "**Deploying to Hockey failed for ${version}** see: ${JOB_URL}"
            throw e
          }
        }, s3: {
          try {
            withEnv(['BUCKET=wire-taco']) {
              if (params.Release.equals('Production')) {
                withCredentials([string(credentialsId: 'AWS_ACCESS_KEY_ID', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'AWS_SECRET_ACCESS_KEY', variable: 'AWS_SECRET_ACCESS_KEY')]) {
                  sh "node ./bin/s3/s3.js -b ${BUCKET} -s Windows -p win/prod -w ${WRAPPER_BUILD}"
                }
              } else if (params.Release.equals('Custom')) {
                withCredentials([string(credentialsId: "${AWS_CUSTOM_ACCESS_KEY_ID}", variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: "${AWS_CUSTOM_SECRET_ACCESS_KEY}", variable: 'AWS_SECRET_ACCESS_KEY')]) {
                  sh "node ./bin/s3/s3.js -b ${WIN_S3_BUCKET} -s Windows -p ${WIN_S3_PATH} -w ${WRAPPER_BUILD}"
                }
              } else {
                withCredentials([string(credentialsId: 'AWS_ACCESS_KEY_ID', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'AWS_SECRET_ACCESS_KEY', variable: 'AWS_SECRET_ACCESS_KEY')]) {
                  sh "node ./bin/s3/s3.js -b ${BUCKET} -s Windows -p win/internal -w ${WRAPPER_BUILD}"
                }
              }
            }
          } catch(e) {
            currentBuild.result = 'FAILED'
            wireSend secret: "$jenkinsbot_secret", message: "**Deploying to S3 failed for ${version}** see: ${JOB_URL}"
            throw e
          }
        }, failFast: true
      } else if (projectName.contains('macOS')) {
        try {
          if (params.Release.equals('Production')) {
            withCredentials([string(credentialsId: 'MACOS_MAS_HOCKEY_TOKEN', variable: 'MACOS_MAS_HOCKEY_TOKEN')]) {
              sh './bin/hockey/macos-prod-hockey.sh'
            }
          } else if (params.Release.equals('Custom')) {
            withCredentials([string(credentialsId: "${MACOS_CUSTOM_HOCKEY_ID}", variable: 'MACOS_CUSTOM_HOCKEY_ID'), string(credentialsId: "${MACOS_CUSTOM_HOCKEY_TOKEN}", variable: 'MACOS_CUSTOM_HOCKEY_TOKEN')]) {
              sh 'node ./bin/hockey/macos-custom-hockey.js'
            }
          } else {
            withCredentials([string(credentialsId: 'MACOS_HOCKEY_TOKEN', variable: 'MACOS_HOCKEY_TOKEN')]) {
              sh 'node ./bin/hockey/macos-internal-hockey.js'
            }
          }
        } catch(e) {
          currentBuild.result = 'FAILED'
          wireSend secret: "$jenkinsbot_secret", message: "**Deploying to Hockey failed for ${version}** see: ${JOB_URL}"
          throw e
        }
      } else if (projectName.contains('Linux')) {
        try {
          if (params.Release.equals('Production')) {
            withEnv(['BUCKET=wire-taco']) {
              withCredentials([string(credentialsId: 'AWS_ACCESS_KEY_ID', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'AWS_SECRET_ACCESS_KEY', variable: 'AWS_SECRET_ACCESS_KEY')]) {
                sh "node ./bin/s3/s3.js -b ${BUCKET} -s Linux -p linux -w ${WRAPPER_BUILD}"
              }
            }
          } else if (params.Release.equals('Custom')) {
            // do nothing
          } else {
            withCredentials([string(credentialsId: 'LINUX_HOCKEY_ID', variable: 'LINUX_HOCKEY_ID'), string(credentialsId: 'LINUX_HOCKEY_TOKEN', variable: 'LINUX_HOCKEY_TOKEN')]) {
              sh 'node ./bin/hockey/linux-internal-hockey.js'
            }
          }
        } catch(e) {
          currentBuild.result = 'FAILED'
          wireSend secret: "$jenkinsbot_secret", message: "**Deploying to Hockey failed for ${version}** see: ${JOB_URL}"
          throw e
        }
      }
    }
  }

  if (projectName.contains('Windows')) {
    stage('Update RELEASES file') {
      try {
        withEnv(['BUCKET=wire-taco', "PATH+NODE=${NODE}/bin"]) {
          if (params.Release.equals('Production')) {
            withCredentials([string(credentialsId: 'AWS_ACCESS_KEY_ID', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'AWS_SECRET_ACCESS_KEY', variable: 'AWS_SECRET_ACCESS_KEY')]) {
              sh "node ./bin/s3/s3-releases.js -b ${BUCKET} -s Windows -p win/prod -w ${WRAPPER_BUILD}"
            }
          } else if (params.Release.equals('Custom')) {
            withCredentials([string(credentialsId: "${AWS_CUSTOM_ACCESS_KEY_ID}", variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: "${AWS_CUSTOM_SECRET_ACCESS_KEY}", variable: 'AWS_SECRET_ACCESS_KEY')]) {
              sh "node ./bin/s3/s3-releases.js -b ${WIN_S3_BUCKET} -s Windows -p ${WIN_S3_PATH} -w ${WRAPPER_BUILD}"
            }
          } else {
            withCredentials([string(credentialsId: 'AWS_ACCESS_KEY_ID', variable: 'AWS_ACCESS_KEY_ID'), string(credentialsId: 'AWS_SECRET_ACCESS_KEY', variable: 'AWS_SECRET_ACCESS_KEY')]) {
              sh "node ./bin/s3/s3-releases.js -b ${BUCKET} -s Windows -p win/internal -w ${WRAPPER_BUILD}"
            }
          }
        }
      } catch(e) {
        currentBuild.result = 'FAILED'
        wireSend secret: "$jenkinsbot_secret", message: "**Changing RELEASES file failed for ${version}** see: ${JOB_URL}"
        throw e
      }
    }
  }

  if (params.Release.equals('Production')) {
    stage('Upload build as draft to GitHub') {
      try {
        withEnv(["PATH+NODE=${NODE}/bin"]) {
          if (projectName.contains('Windows')) {
            withCredentials([string(credentialsId: 'GITHUB_ACCESS_TOKEN', variable: 'GITHUB_ACCESS_TOKEN')]) {
              sh 'cd wrap/prod/Wire-win32-ia32/ && node ../../../bin/github_draft.js'
            }
          } else if (projectName.contains('macOS')) {
            withCredentials([string(credentialsId: 'GITHUB_ACCESS_TOKEN', variable: 'GITHUB_ACCESS_TOKEN')]) {
              sh 'node bin/github_draft.js'
            }
          } else if (projectName.contains('Linux')) {
            withCredentials([string(credentialsId: 'GITHUB_ACCESS_TOKEN', variable: 'GITHUB_ACCESS_TOKEN')]) {
              sh 'cd wrap/dist/ && node ../../bin/github_draft.js'
            }
          }
        }
      } catch(e) {
        currentBuild.result = 'FAILED'
        wireSend secret: "$jenkinsbot_secret", message: "**Upload build as draft to Github failed for ${version}** see: ${JOB_URL}"
        throw e
      }
    }
  }
}
