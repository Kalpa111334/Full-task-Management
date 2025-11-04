# Super Admin & Multi-Department Management

## Overview

This feature allows system administrators (super admins) to create admin roles that can manage multiple departments simultaneously. This is useful for organizations where certain administrators need oversight across multiple departments.

## Key Features

### 1. **New Role Types**
- **Super Admin**: Highest level admin with full system access
- **Admin**: Department-level admin with access to specific departments

Both `admin` and `super_admin` roles can now be assigned to manage multiple departments.

### 2. **Multi-Department Assignment**
When creating or editing an employee with `admin` or `super_admin` role:
- Select multiple departments using checkboxes
- At least one department must be selected
- Departments are stored in the `admin_departments` junction table

### 3. **Database Schema**

#### New Table: `admin_departments`
```sql
CREATE TABLE admin_departments (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES employees(id),
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMPTZ,
  UNIQUE(admin_id, department_id)
);
```

#### Updated Employee Role Enum
```sql
ALTER TYPE employee_role ADD VALUE 'super_admin';
-- Values: 'employee', 'department_head', 'admin', 'super_admin'
```

## Usage Guide

### Creating a Multi-Department Admin

1. **Navigate to Admin Panel**
   - Log in as a super admin
   - Go to "Employee Management" tab

2. **Add/Edit Employee**
   - Click "Add Employee" or edit an existing employee
   - Fill in basic details (name, email, password, phone)
   - Select role: **Admin** or **Super Admin**

3. **Assign Departments**
   - When Admin or Super Admin is selected, a "Manage Departments" section appears
   - Check all departments this admin should manage
   - At least one department must be selected
   - Click "Add Employee" or "Update Employee"

### Viewing Admin Assignments

In the Employee Management list:
- Admins will show a "Manages Departments" section
- All assigned departments are displayed as badges under the employee details

### Super Admin vs Admin

| Feature | Super Admin | Admin |
|---------|------------|-------|
| Create/Edit Employees | ✅ | ✅ |
| Manage Departments | ✅ | ✅ (assigned only) |
| Create Admin Roles | ✅ | ❌ |
| System Configuration | ✅ | ❌ |
| Multi-Department Access | ✅ | ✅ |

## API Examples

### Fetch Admin Departments
```typescript
const { data, error } = await supabase
  .from("admin_departments")
  .select("department_id, departments:departments(name)")
  .eq("admin_id", adminId);
```

### Assign Departments to Admin
```typescript
// Delete existing assignments
await supabase
  .from("admin_departments")
  .delete()
  .eq("admin_id", adminId);

// Insert new assignments
await supabase
  .from("admin_departments")
  .insert(
    departmentIds.map(deptId => ({
      admin_id: adminId,
      department_id: deptId
    }))
  );
```

### Check Admin Access to Department
```typescript
const { data } = await supabase
  .from("admin_departments")
  .select("id")
  .eq("admin_id", adminId)
  .eq("department_id", departmentId)
  .single();

const hasAccess = !!data;
```

## Migration

The database migration is located at:
```
supabase/migrations/20251104000000_add_super_admin_and_multi_department.sql
```

To apply the migration:
```bash
# Local development
supabase db reset

# Production
supabase db push
```

## Security Considerations

1. **Row Level Security (RLS)**
   - All policies are set to allow read/write for authenticated users
   - Consider implementing more granular policies based on your security requirements

2. **Validation**
   - Frontend validates that admins have at least one department
   - Backend should also validate this constraint

3. **Audit Trail**
   - All admin_departments changes are timestamped
   - Consider adding an audit log for department assignment changes

## UI Components

### Updated Components
- `src/components/admin/EmployeeManagement.tsx`
  - Added multi-department checkbox selection
  - Added department display in employee list
  - Added validation for admin department requirements

### New Imports
```typescript
import { Checkbox } from "@/components/ui/checkbox";
```

## Type Definitions

Updated TypeScript types in `src/integrations/supabase/types.ts`:

```typescript
// New table type
admin_departments: {
  Row: {
    admin_id: string
    created_at: string | null
    department_id: string
    id: string
  }
  // ... Insert and Update types
}

// Updated enum
employee_role: "admin" | "department_head" | "employee" | "super_admin"
```

## Testing

### Test Scenarios

1. **Create Super Admin with Multiple Departments**
   - Create a new employee
   - Assign "Super Admin" role
   - Select 3+ departments
   - Verify assignment success

2. **Edit Admin Department Assignments**
   - Edit an existing admin
   - Change department assignments
   - Verify changes are saved

3. **Remove All Departments**
   - Try to remove all departments from an admin
   - Should show validation error

4. **Role Change from Admin to Employee**
   - Change admin to employee role
   - Verify admin_departments entries are not displayed
   - Department assignments should be preserved (optional: delete them)

5. **Login as Multi-Department Admin**
   - Login with multi-department admin credentials
   - Verify access to all assigned departments

## Future Enhancements

1. **Department-Specific Permissions**
   - Add granular permissions per department (read-only, full access, etc.)

2. **Audit Logging**
   - Track who assigned/removed departments
   - Track admin actions across departments

3. **Department Groups**
   - Create department groups for easier bulk assignment

4. **Admin Dashboard Filtering**
   - Filter admin view by assigned departments
   - Show department-specific statistics

5. **Cascade Deletion Handling**
   - Define behavior when admin or department is deleted

## Troubleshooting

### Issue: Departments not showing in admin list
**Solution**: Ensure the fetch includes the join with admin_departments table

### Issue: Validation error on save
**Solution**: Verify at least one department is selected for admin/super_admin roles

### Issue: Changes not persisting
**Solution**: Check browser console for errors, verify RLS policies are correctly set

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify database migration was applied
3. Check Supabase logs for RLS policy errors
4. Review the code comments in EmployeeManagement.tsx

---

**Last Updated**: November 4, 2025
**Version**: 1.0.0
