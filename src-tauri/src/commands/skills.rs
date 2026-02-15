use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::command;
use log::{info, error, debug};

#[derive(Debug, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub path: String,
}

#[derive(Debug, Deserialize)]
struct SkillFrontmatter {
    name: String,
    description: Option<String>,
}

#[command]
pub async fn get_skills() -> Result<Vec<Skill>, String> {
    info!("Executing get_skills command");
    let mut skills = Vec::new();
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let skills_dir = home_dir.join(".openclaw").join("skills");
    info!("Using skills directory: {:?}", skills_dir);

    if !skills_dir.exists() {
        info!("Skills directory does not exist, looking in ~/.openclaw/skills");
        return Ok(skills);
    }

    let entries = fs::read_dir(&skills_dir)
        .map_err(|e| format!("Failed to read skills directory: {}", e))?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    let content = fs::read_to_string(&skill_md)
                        .map_err(|e| format!("Failed to read SKILL.md: {}", e))?;
                    
                    // Simple frontmatter parsing
                    if content.starts_with("---") {
                        if let Some(end_idx) = content[3..].find("---") {
                            let frontmatter_str = &content[3..end_idx+3];
                            match serde_yaml::from_str::<SkillFrontmatter>(frontmatter_str) {
                                Ok(frontmatter) => {
                                    info!("Loaded skill: {}", frontmatter.name);
                                    skills.push(Skill {
                                        id: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                                        name: frontmatter.name,
                                        description: frontmatter.description,
                                        path: path.to_string_lossy().to_string(),
                                    });
                                }
                                Err(e) => {
                                    error!("Failed to parse frontmatter for {:?}: {}", path, e);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    info!("Returning {} skills", skills.len());
    Ok(skills)
}

fn create_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

#[command]
pub async fn check_clawhub_installed() -> Result<bool, String> {
    info!("Checking if clawhub is installed");
    
    // Method 1: Check if 'clawhub' command exists
    #[cfg(target_os = "windows")]
    let program = "cmd";
    #[cfg(target_os = "windows")]
    let args = ["/C", "clawhub --version"];

    #[cfg(not(target_os = "windows"))]
    let program = "clawhub";
    #[cfg(not(target_os = "windows"))]
    let args = ["--version"];

    if let Ok(output) = create_command(program).args(args).output() {
        if output.status.success() {
            debug!("clawhub command found locally");
            return Ok(true);
        }
    }

    // Method 2: Check via npm list -g (more robust if PATH isn't updated)
    info!("Direct command failed, checking via npm list -g");
    #[cfg(target_os = "windows")]
    let program = "cmd";
    #[cfg(target_os = "windows")]
    let args = ["/C", "npm list -g clawhub --depth=0"];

    #[cfg(not(target_os = "windows"))]
    let program = "npm";
    #[cfg(not(target_os = "windows"))]
    let args = ["list", "-g", "clawhub", "--depth=0"];

    let output = create_command(program)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute npm list: {}", e))?;

    // npm list returns 0 if found (or empty), 1 if empty/error depending on version
    // We check if stdout contains "clawhub@"
    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.contains("clawhub@") {
        debug!("clawhub found in npm global list");
        Ok(true)
    } else {
        debug!("clawhub not found in npm global list");
        Ok(false)
    }
}

#[command]
pub async fn install_clawhub() -> Result<String, String> {
    info!("Installing clawhub globally via npm");

    #[cfg(target_os = "windows")]
    let program = "cmd";
    #[cfg(target_os = "windows")]
    let args = ["/C", "npm install -g clawhub"];

    #[cfg(not(target_os = "windows"))]
    let program = "npm";
    #[cfg(not(target_os = "windows"))]
    let args = ["install", "-g", "clawhub"];

    let output = create_command(program)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute npm install: {}", e))?;

    if output.status.success() {
        info!("clawhub installed successfully");
        Ok("Clawhub installed successfully".to_string())
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        error!("Failed to install clawhub: {}", error_msg);
        Err(format!("Failed to install clawhub: {}", error_msg))
    }
}

#[command]
pub async fn install_skill(skill_name: String) -> Result<String, String> {
    info!("Installing skill: {}", skill_name);
    
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let openclaw_dir = home_dir.join(".openclaw");
    
    // Ensure .openclaw directory exists
    if !openclaw_dir.exists() {
        fs::create_dir_all(&openclaw_dir)
            .map_err(|e| format!("Failed to create .openclaw directory: {}", e))?;
    }

    // Run 'npx clawhub install <skill_name>' in ~/.openclaw
    #[cfg(target_os = "windows")]
    let program = "cmd";
    #[cfg(target_os = "windows")]
    let args = ["/C", "npx", "clawhub", "install", &skill_name];

    #[cfg(not(target_os = "windows"))]
    let program = "npx";
    #[cfg(not(target_os = "windows"))]
    let args = ["clawhub", "install", &skill_name];

    let output = create_command(program)
        .args(args)
        .current_dir(&openclaw_dir)
        .output()
        .map_err(|e| format!("Failed to execute clawhub install: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        info!("Skill installed successfully: {}", stdout);
        Ok(stdout.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!("Failed to install skill: {}", stderr);
        Err(format!("Failed to install skill: {}", stderr))
    }
}

#[command]
pub async fn uninstall_skill(skill_id: String) -> Result<String, String> {
    info!("Uninstalling skill: {}", skill_id);
    
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let skill_path = home_dir.join(".openclaw").join("skills").join(&skill_id);
    
    if !skill_path.exists() {
        return Err(format!("Skill directory not found: {:?}", skill_path));
    }

    info!("Removing directory: {:?}", skill_path);
    fs::remove_dir_all(&skill_path)
        .map_err(|e| format!("Failed to remove skill directory: {}", e))?;

    info!("Skill uninstalled successfully");
    Ok("Skill uninstalled successfully".to_string())
}

#[command]
pub async fn uninstall_clawhub() -> Result<String, String> {
    info!("Uninstalling clawhub globally via npm");

    #[cfg(target_os = "windows")]
    let program = "cmd";
    #[cfg(target_os = "windows")]
    let args = ["/C", "npm uninstall -g clawhub"];

    #[cfg(not(target_os = "windows"))]
    let program = "npm";
    #[cfg(not(target_os = "windows"))]
    let args = ["uninstall", "-g", "clawhub"];

    let output = create_command(program)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute npm uninstall: {}", e))?;

    if output.status.success() {
        info!("clawhub uninstalled successfully");
        Ok("Clawhub uninstalled successfully".to_string())
    } else {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        error!("Failed to uninstall clawhub: {}", error_msg);
        Err(format!("Failed to uninstall clawhub: {}", error_msg))
    }
}
