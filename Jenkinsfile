pipeline {
    agent any

    // Vérifie GitHub toutes les 2 minutes : un nouveau commit lance le pipeline
    triggers { pollSCM('H/2 * * * *') }

    environment { IMAGE = 'emnawalha99/counter-app' }

    stages {
        stage('Build & Tests') {
            steps {
                sh 'npm ci'
                sh 'npm test'
            }
        }

        stage('Docker Build & Push') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
                    sh 'echo $DH_TOKEN | docker login -u $DH_USER --password-stdin'
                    sh 'docker build -t $IMAGE:$BUILD_NUMBER -t $IMAGE:latest .'
                    sh 'docker push $IMAGE:$BUILD_NUMBER'
                    sh 'docker push $IMAGE:latest'
                }
            }
        }
    }
}
