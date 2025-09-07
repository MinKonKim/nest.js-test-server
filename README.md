# 이 프로젝트는 NestJS와 Socket.IO를 기반으로 한 실시간 멀티플레이어 그림 맞추기 게임입니다.

## 로컬에서 테스트하는 방법

#### 1. 사전 준비

- [Node.js](https://nodejs.org/) (v18 이상 권장)
- [pnpm](https://pnpm.io/installation) 패키지 매니저

#### 2. 설치

프로젝트의 의존성을 설치합니다.

```bash
$ pnpm install
```

#### 3. 환경 변수 설정 (선택 사항)

이 프로젝트는 `.env` 파일을 통해 환경 변수를 설정할 수 있습니다. 서버를 여러 대 운영(스케일 아웃)할 때 필요한 `REDIS_URL`과 같은 값을 설정하는 데 사용됩니다.

- 프로젝트 루트의 `.env.example` 파일을 복사하여 `.env` 파일을 생성합니다.
- 로컬에서 단일 서버로 테스트하는 경우에는 이 과정 없이도 정상적으로 동작합니다.

```bash
# .env.example 파일을 복사하여 .env 파일 생성
cp .env.example .env
```

#### 4. 서버 실행

NestJS 개발 서버를 watch 모드로 실행합니다. 코드가 변경될 때마다 서버가 자동으로 재시작됩니다.

```bash
$ pnpm run start:dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

#### 4. 브라우저에서 테스트

1.  프로젝트 루트 디렉토리에 있는 `test/test.html` 파일을 웹 브라우저에서 엽니다.
2.  **여러 플레이어를 시뮬레이션하려면,** 같은 파일을 여러 개의 브라우저 탭이나 창에서 엽니다. (최소 2개 이상)
3.  **게임 진행:**
    - 가장 먼저 접속한 탭(플레이어)이 **출제자**가 됩니다.
    - 출제자는 화면 상단에 제시어를 확인하고 그림을 그릴 수 있습니다.
    - 나중에 접속한 탭(플레이어)은 **참여자**가 되며, 그림판이 비활성화되고 정답 입력창이 나타납니다.
    - 참여자가 정답을 맞히면 라운드가 종료되고, 3초 후에 다음 사람이 출제자가 되어 새로운 라운드가 자동으로 시작됩니다.

---

## 향후 확장 계획

현재 핵심 게임 루프는 완성되었으며, 다음과 같은 방향으로 기능을 확장할 수 있습니다.

#### 1. 게임플레이 강화

- **점수 시스템 고도화:** 정답을 빨리 맞힐수록 높은 점수를 부여하는 등 점수 체계를 구체화합니다.
- **라운드 타이머:** 한 라운드당 제한 시간을 두어 게임의 긴장감을 높입니다.
- **출제자 연결 종료 처리:** 출제자가 게임 도중 나가면, 즉시 다음 라운드를 시작하거나 다른 출제자를 지정하는 로직을 추가합니다. (`game.service.ts`의 `removePlayerFromAll`에 관련 TODO가 있습니다.)

#### 2. UI/UX 개선

- **프론트엔드 프레임워크 도입:** 현재의 `test.html`을 React, Vue 등 모던 프론트엔드 프레임워크로 전환하여 사용자 경험을 개선합니다.
- **그림 도구 확장:** 색상 선택, 붓 크기 조절, 지우개 등 다양한 그리기 도구를 추가합니다.
- **UI 개선:** 채팅/정답 로그, 플레이어 목록, 점수판 등의 UI를 깔끔하게 디자인합니다.

#### 3. 사용자 및 방 관리 기능

- **사용자 인증:** 임의의 `user-xxxx` 이름 대신, 사용자가 직접 닉네임을 설정하고 점수를 유지할 수 있는 계정 시스템을 도입합니다.
- **로비 시스템:** 사용자가 직접 방을 만들거나, 공개된 방 목록을 보고 참여할 수 있는 로비 기능을 구현합니다.
- **비밀방 기능:** 방에 비밀번호를 설정하여 친구들만 들어올 수 있도록 합니다.

#### 4. 프로덕션 및 확장성

- **Redis 어댑터 테스트:** 여러 서버 인스턴스 환경에서도 원활한 통신이 가능한지 Redis 어댑터 연동을 테스트하고 안정화합니다.
- **Docker 컨테이너화:** 애플리케이션을 Dockerize하여 배포를 용이하게 만듭니다.
- **CI/CD 파이프라인 구축:** 코드 변경 시 자동으로 테스트, 빌드, 배포가 이루어지도록 CI/CD 환경을 설정합니다.

---

## 기존 NestJS 정보

(이하 내용은 NestJS 기본 README입니다.)

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ pnpm install
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
