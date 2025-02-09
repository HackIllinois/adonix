// // project-router.test.ts
// import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
// import { getAsAttendee, getAsStaff, postAsAttendee, patchAsAttendee, delAsAttendee, TESTER, getAsAdmin, getAsUser } from "../../common/testTools";
// import Models from "../../common/models";
// import { StatusCode } from "status-code-enum";
// import { PathType, Project, TrackType } from "./project-schema"; // adjust the import path as needed

// // --- Test data definitions ---

// // Data for a project owned by TESTER
// const TESTER_PROJECT = {
//   ownerId: TESTER.id,
//   projectName: "Test Project",
//   description: "A test project",
//   path: PathType.GENERAL,
//   track: TrackType.SPONSOR_1,
//   githubLink: "https://github.com/test",
//   videoLink: "https://youtube.com/test",
//   accessCode: "ABCDE",
//   expiryTime: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
//   teamMembers: [] as string[],
// } satisfies Project;

// const TESTER_CREATE_PROJECT_REQUEST = {
//     projectName: "Test Project",
//     description: "A test project",
//     path: PathType.GENERAL,
//     track: TrackType.SPONSOR_1,
//     githubLink: "https://github.com/test",
//     videoLink: "https://youtube.com/test",
//     teamMembers: [] as string[],
//   };

// // Mapping for a team in which TESTER is the owner
// const TESTER_MAPPING = {
//   teamOwnerId: TESTER.id,
//   userId: TESTER.id,
// };

// // Data for a project owned by another user ("owner2")
// const OTHER_PROJECT = {
//   ownerId: "owner2",
//   projectName: "Other Project",
//   description: "Other project description",
//   path: PathType.GENERAL,
//   track: "Other Track",
//   githubLink: "https://github.com/other",
//   videoLink: "https://youtube.com/other",
//   accessCode: "JOIN1",
//   expiryTime: new Date(Date.now() + 300000).toISOString(),
//   teamMembers: [] as string[],
// };

// const OTHER_MAPPING = {
//   teamOwnerId: "owner2",
//   userId: "owner2",
// };

// // --- Before/After Hooks ---
// // Ensure that before each test the project-related collections are cleared
// beforeEach(async () => {
//   await Models.ProjectProjects.deleteMany({});
//   await Models.ProjectMappings.deleteMany({});
// });

// afterEach(async () => {
//   await Models.ProjectProjects.deleteMany({});
//   await Models.ProjectMappings.deleteMany({});
// });

// // --- Test Suites ---

// describe("Project Router", () => {
// //   // GET /project/:ownerId/ (staff only)
// //   describe("GET /project/:ownerId/", () => {
// //     it("should give a forbidden error for a non-staff user", async () => {
// //       const response = await getAsAttendee(`/project/${TESTER.id}/`).expect(
// //         StatusCode.ClientErrorForbidden
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
// //     });

// //     it("should give a not found error if the project does not exist (staff user)", async () => {
// //       // No project created for TESTER yet.
// //       const response = await getAsStaff(`/project/${TESTER.id}/`).expect(
// //         StatusCode.ClientErrorNotFound
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error", "NoTeamFound");
// //     });

// //     it("should return project details for a staff user", async () => {
// //       // Create a project for TESTER
// //       await Models.ProjectProjects.create(TESTER_PROJECT);
// //       const response = await getAsStaff(`/project/${TESTER.id}/`).expect(
// //         StatusCode.SuccessOK
// //       );
// //       const project = JSON.parse(response.text);
// //       expect(project).toMatchObject({
// //         ownerId: TESTER.id
// //       });
// //     });
// //   });

// //   // GET /project (get details of user's team)
// //   describe("GET /project/", () => {
// //     it("should return a not found error if the user is not in any team", async () => {
// //         // get as admin goes thru
// //       const response = await getAsAttendee("/project/").expect(
// //         StatusCode.ClientErrorNotFound
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error", "NoTeamFound");
// //     });

// //     it("should return the user's team details if a team exists", async () => {
// //       await Models.ProjectMappings.create(TESTER_MAPPING);
// //       await Models.ProjectProjects.create(TESTER_PROJECT);
// //       const response = await getAsAttendee("/project/").expect(
// //         StatusCode.SuccessOK
// //       );
// //       const project = JSON.parse(response.text);
// //       expect(project).toMatchObject({
// //         ownerId: TESTER.id,
// //         projectName: "Test Project",
// //       });
// //     });
// //   });

// //   // POST /project (create a new project/team)
// //   describe("POST /project", () => {
// //     const createPayload = {
// //       projectName: "New Project",
// //       description: "New project description",
// //       path: PathType.GENERAL,
// //       track: "New Track",
// //       githubLink: "https://github.com/new",
// //       videoLink: "https://youtube.com/new",
// //     };

// //     it("should create a new project if the user is not already in a team", async () => {
// //       const response = await postAsAttendee("/project").send(TESTER_CREATE_PROJECT_REQUEST).expect(
// //         StatusCode.SuccessCreated
// //       );
// //       const project = JSON.parse(response.text);
// //       expect(project).toMatchObject({
// //         ownerId: TESTER.id,
// //         projectName: "New Project",
// //         description: "New project description",
// //         path: createPayload.path,
// //         track: "New Track",
// //         githubLink: "https://github.com/new",
// //         videoLink: "https://youtube.com/new",
// //       });
// //       // Also verify that a mapping was created
// //       const mapping = await Models.ProjectMappings.findOne({ userId: TESTER.id });
// //       expect(mapping).not.toBeNull();
// //     });

// //     it("should return a conflict error if the user already has a team", async () => {
// //       await Models.ProjectMappings.create(TESTER_MAPPING);
// //       await Models.ProjectProjects.create(TESTER_PROJECT);
// //       const response = await postAsAttendee("/project").send(TESTER_CREATE_PROJECT_REQUEST).expect(
// //         StatusCode.ClientErrorConflict
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error");
// //     });
// //   });

//   // PATCH /project (update team details; owner only)
//   describe("PATCH /project", () => {
//     const updateProject = {
//       updateProject: "Updated Project",
//       description: "Updated description",
//     };

//     it("should return a forbidden error if the user is not the team owner", async () => {
//       // No project exists for TESTER.
//       const response = await patchAsAttendee("/project").send(updateProject).expect(
//         StatusCode.ClientErrorForbidden
//       );
//       expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
//     });

//     it("should update the project details if the user is the owner", async () => {
//       await Models.ProjectMappings.create(TESTER_MAPPING);
//       await Models.ProjectProjects.create(TESTER_PROJECT);
//       const response = await patchAsAttendee("/project").send(updateProject).expect(
//         StatusCode.SuccessOK
//       );
//       const updatedProject = JSON.parse(response.text);
//       expect(updatedProject).toMatchObject({
//         ownerId: TESTER.id,
//         projectName: "Updated Project",
//         description: "Updated description",
//       });
//     });
//   });

// //   // POST /project/join (join a team using an access code)
// //   describe("POST /project/join", () => {
// //     const joinPayload = { accessCode: "JOIN1" };

// //     it("should allow a user to join a team with a valid access code", async () => {
// //       // Create a project for another team (owner "owner2")
// //       await Models.ProjectMappings.create(OTHER_MAPPING);
// //       await Models.ProjectProjects.create(OTHER_PROJECT);
// //       const response = await postAsAttendee("/project/join", joinPayload).expect(
// //         StatusCode.SuccessOK
// //       );
// //       const project = JSON.parse(response.text);
// //       expect(project.teamMembers).toContain(TESTER.id);
// //       const mapping = await Models.ProjectMappings.findOne({ userId: TESTER.id });
// //       expect(mapping).not.toBeNull();
// //     });

// //     it("should return a bad request error for an invalid access code", async () => {
// //       const invalidPayload = { accessCode: "WRONG" };
// //       const response = await postAsAttendee("/project/join", invalidPayload).expect(
// //         StatusCode.ClientErrorBadRequest
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error");
// //     });

// //     it("should return a conflict error if the user is already in a team", async () => {
// //       // First create a team for TESTER
// //       await Models.ProjectMappings.create(TESTER_MAPPING);
// //       await Models.ProjectProjects.create(TESTER_PROJECT);
// //       const response = await postAsAttendee("/project/join", joinPayload).expect(
// //         StatusCode.ClientErrorConflict
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error");
// //     });
// //   });

// //   // POST /project/leave (leave a team)
// //   describe("POST /project/leave/", () => {
// //     it("should return a conflict error if the user is not in any team", async () => {
// //       const response = await postAsAttendee("/project/leave/").expect(
// //         StatusCode.ClientErrorConflict
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error");
// //     });

// //     it("should allow a non-owner to leave the team", async () => {
// //       // Create a team where the owner is "owner2" and TESTER is a member.
// //       const projectWithMember = {
// //         ownerId: "owner2",
// //         projectName: "Team Project",
// //         description: "Team project description",
// //         path: PathType.GENERAL,
// //         track: "Team Track",
// //         githubLink: "https://github.com/team",
// //         videoLink: "https://youtube.com/team",
// //         accessCode: "TEAM1",
// //         expiryTime: new Date(Date.now() + 300000).toISOString(),
// //         teamMembers: [TESTER.id],
// //       };
// //       await Models.ProjectMappings.create({ teamOwnerId: "owner2", userId: "owner2" });
// //       await Models.ProjectMappings.create({ teamOwnerId: "owner2", userId: TESTER.id });
// //       await Models.ProjectProjects.create(projectWithMember);

// //       const response = await postAsAttendee("/project/leave/").expect(
// //         StatusCode.SuccessOK
// //       );
// //       expect(JSON.parse(response.text)).toBe(TESTER.id);
// //       // Verify that TESTER's mapping is removed.
// //       const mapping = await Models.ProjectMappings.findOne({ userId: TESTER.id });
// //       expect(mapping).toBeNull();
// //       // Also, check that TESTER has been removed from the project's teamMembers.
// //       const project = await Models.ProjectProjects.findOne({ ownerId: "owner2" });
// //       expect(project?.teamMembers).not.toContain(TESTER.id);
// //     });

// //     it("should disband the team if the owner leaves", async () => {
// //       // Create a team with TESTER as owner.
// //       await Models.ProjectMappings.create(TESTER_MAPPING);
// //       await Models.ProjectProjects.create(TESTER_PROJECT);

// //       const response = await postAsAttendee("/project/leave/").expect(
// //         StatusCode.SuccessOK
// //       );
// //       expect(JSON.parse(response.text)).toBe(TESTER.id);
// //       // The project should be deleted.
// //       const project = await Models.ProjectProjects.findOne({ ownerId: TESTER.id });
// //       expect(project).toBeNull();
// //       // And all mappings for this team should be removed.
// //       const mapping = await Models.ProjectMappings.findOne({ teamOwnerId: TESTER.id });
// //       expect(mapping).toBeNull();
// //     });
// //   });

// //   // GET /project/list/ (staff only)
// //   describe("GET /project/list/", () => {
// //     it("should give a forbidden error for a non-staff user", async () => {
// //       const response = await getAsAttendee("/project/list/").expect(
// //         StatusCode.ClientErrorForbidden
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
// //     });

// //     it("should return a list of projects for a staff user", async () => {
// //       // Create two projects
// //       await Models.ProjectProjects.create(TESTER_PROJECT);
// //       await Models.ProjectProjects.create({
// //         ...TESTER_PROJECT,
// //         ownerId: "owner2",
// //         projectName: "Second Project",
// //       });
// //       const response = await getAsStaff("/project/list/").expect(StatusCode.SuccessOK);
// //       const data = JSON.parse(response.text);
// //       expect(Array.isArray(data.projects)).toBe(true);
// //       expect(data.projects.length).toBeGreaterThanOrEqual(2);
// //     });
// //   });

// //   // DELETE /project/member/:userId (remove a team member)
// //   describe("DELETE /project/member/:userId", () => {
// //     it("should return a not found error if the user is not in any team", async () => {
// //       const response = await delAsAttendee("/project/member/nonexistent").expect(
// //         StatusCode.ClientErrorNotFound
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
// //     });

// //     it("should remove a team member successfully", async () => {
// //       // Create a team where TESTER is a non-owner member.
// //       const projectWithMember = {
// //         ownerId: "owner2",
// //         projectName: "Team Project",
// //         description: "Team project description",
// //         path: PathType.GENERAL,
// //         track: "Team Track",
// //         githubLink: "https://github.com/team",
// //         videoLink: "https://youtube.com/team",
// //         accessCode: "TEAM1",
// //         expiryTime: new Date(Date.now() + 300000).toISOString(),
// //         teamMembers: [TESTER.id],
// //       };
// //       await Models.ProjectMappings.create({ teamOwnerId: "owner2", userId: "owner2" });
// //       await Models.ProjectMappings.create({ teamOwnerId: "owner2", userId: TESTER.id });
// //       await Models.ProjectProjects.create(projectWithMember);

// //       const response = await delAsAttendee(`/project/member/${TESTER.id}`).expect(
// //         StatusCode.SuccessOK
// //       );
// //       expect(JSON.parse(response.text)).toBe(TESTER.id);
// //       const mapping = await Models.ProjectMappings.findOne({ userId: TESTER.id });
// //       expect(mapping).toBeNull();
// //     });

// //     it("should disband the team if the owner is removed", async () => {
// //       await Models.ProjectMappings.create(TESTER_MAPPING);
// //       await Models.ProjectProjects.create(TESTER_PROJECT);
// //       const response = await delAsAttendee(`/project/member/${TESTER.id}`).expect(
// //         StatusCode.SuccessOK
// //       );
// //       expect(JSON.parse(response.text)).toBe(TESTER.id);
// //       const project = await Models.ProjectProjects.findOne({ ownerId: TESTER.id });
// //       expect(project).toBeNull();
// //     });
// //   });

// //   // GET /project/generate-access-code (owner only)
// //   describe("GET /project/generate-access-code", () => {
// //     it("should return a not found error if the user is not in any team", async () => {
// //       const response = await getAsAttendee("/project/generate-access-code").expect(
// //         StatusCode.ClientErrorNotFound
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
// //     });

// //     it("should return a forbidden error if the user is not the team owner", async () => {
// //       // Create a team where the owner is "owner2" and TESTER is a member.
// //       const projectWithMember = {
// //         ownerId: "owner2",
// //         projectName: "Team Project",
// //         description: "Team project description",
// //         path: PathType.GENERAL,
// //         track: "Team Track",
// //         githubLink: "https://github.com/team",
// //         videoLink: "https://youtube.com/team",
// //         accessCode: "TEAM1",
// //         expiryTime: new Date(Date.now() + 300000).toISOString(),
// //         teamMembers: [TESTER.id],
// //       };
// //       await Models.ProjectMappings.create({ teamOwnerId: "owner2", userId: "owner2" });
// //       await Models.ProjectMappings.create({ teamOwnerId: "owner2", userId: TESTER.id });
// //       await Models.ProjectProjects.create(projectWithMember);

// //       const response = await getAsAttendee("/project/generate-access-code").expect(
// //         StatusCode.ClientErrorForbidden
// //       );
// //       expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
// //     });

// //     it("should generate a new access code for the owner", async () => {
// //       await Models.ProjectMappings.create(TESTER_MAPPING);
// //       await Models.ProjectProjects.create(TESTER_PROJECT);
// //       const response = await getAsAttendee("/project/generate-access-code").expect(
// //         StatusCode.SuccessOK
// //       );
// //       const data = JSON.parse(response.text);
// //       expect(data).toHaveProperty("ownerId", TESTER.id);
// //       expect(data).toHaveProperty("accessCode");
// //       expect(data).toHaveProperty("expiryTime");
// //     });
// //   });
// });
